#include "store.hpp"

#include <algorithm>
#include <array>
#include <cmath>
#include <fstream>
#if defined(__GLIBC__)
#include <malloc.h>
#endif
#include <stdexcept>

namespace ninacal {

namespace {

const std::map<std::string, std::string, std::less<>> country_names = {
    {"PE", "Peru"},      {"US", "United States"}, {"EC", "Ecuador"},   {"CL", "Chile"},
    {"CO", "Colombia"},  {"PY", "Paraguay"},      {"MX", "Mexico"},    {"BO", "Bolivia"},
    {"VE", "Venezuela"}, {"AR", "Argentina"},     {"AU", "Australia"}, {"BR", "Brazil"},
};

std::array<double, 4> robust_bbox(std::vector<std::pair<double, double>> points) {
    if (points.empty()) return {0, 0, 0, 0};
    std::sort(points.begin(), points.end());
    std::size_t split = 0;
    double largest = 0.0;
    for (std::size_t i = 0; i + 1 < points.size(); ++i) {
        double gap = points[i + 1].first - points[i].first;
        if (gap > largest) {
            largest = gap;
            split = i + 1;
        }
    }
    std::size_t begin = 0;
    std::size_t end = points.size();
    // A gap over 180 degrees is the antimeridian/remote-island split; keep the
    // larger cluster so Alaska, Chile and Ecuador fit their mainland.
    if (largest > 180.0) {
        if (split >= points.size() - split) {
            end = split;
        } else {
            begin = split;
        }
    }
    double west = points[begin].first, east = points[begin].first;
    double south = points[begin].second, north = points[begin].second;
    for (std::size_t i = begin; i < end; ++i) {
        west = std::min(west, points[i].first);
        east = std::max(east, points[i].first);
        south = std::min(south, points[i].second);
        north = std::max(north, points[i].second);
    }
    return {west, south, east, north};
}

nlohmann::ordered_json read_json(const std::filesystem::path &path) {
    std::ifstream input(path);
    if (!input) {
        throw std::runtime_error("cannot read " + path.string());
    }
    return nlohmann::ordered_json::parse(input);
}

sqlite3 *open_read_only(const std::filesystem::path &path) {
    sqlite3 *db = nullptr;
    if (sqlite3_open_v2(path.c_str(), &db, SQLITE_OPEN_READONLY | SQLITE_OPEN_NOMUTEX, nullptr) != SQLITE_OK) {
        std::string message = db ? sqlite3_errmsg(db) : "out of memory";
        sqlite3_close(db);
        throw std::runtime_error("cannot open " + path.string() + ": " + message);
    }
    const char *setup = "PRAGMA mmap_size=0;";
    char *error = nullptr;
    if (sqlite3_exec(db, setup, nullptr, nullptr, &error) != SQLITE_OK) {
        std::string message = error ? error : "unknown error";
        sqlite3_free(error);
        sqlite3_close(db);
        throw std::runtime_error("cannot prepare connection: " + message);
    }
    return db;
}

}

Statement::Statement(sqlite3 *db, std::string_view sql) : db_(db) {
    if (sqlite3_prepare_v2(db, sql.data(), static_cast<int>(sql.size()), &statement_, nullptr) != SQLITE_OK) {
        throw std::runtime_error(std::string("SQL error: ") + sqlite3_errmsg(db));
    }
}

Statement::~Statement() {
    sqlite3_finalize(statement_);
}

Statement &Statement::bind(int index, std::string_view text) {
    sqlite3_bind_text(statement_, index, text.data(), static_cast<int>(text.size()), SQLITE_TRANSIENT);
    return *this;
}

Statement &Statement::bind(int index, int value) {
    sqlite3_bind_int(statement_, index, value);
    return *this;
}

bool Statement::step() {
    int rc = sqlite3_step(statement_);
    if (rc == SQLITE_ROW) {
        return true;
    }
    if (rc == SQLITE_DONE) {
        return false;
    }
    throw std::runtime_error(std::string("SQL error: ") + sqlite3_errmsg(db_));
}

void Statement::reset() {
    sqlite3_reset(statement_);
    sqlite3_clear_bindings(statement_);
}

bool Statement::null(int column) const {
    return sqlite3_column_type(statement_, column) == SQLITE_NULL;
}

int Statement::integer(int column) const {
    return sqlite3_column_int(statement_, column);
}

double Statement::real(int column) const {
    return sqlite3_column_double(statement_, column);
}

std::string Statement::text(int column) const {
    const auto *value = sqlite3_column_text(statement_, column);
    return value ? reinterpret_cast<const char *>(value) : "";
}

Store::Store(std::filesystem::path database, std::filesystem::path data)
    : database_(std::move(database)), data_(std::move(data)) {
    if (!std::filesystem::is_regular_file(database_)) {
        throw std::runtime_error("database not found: " + database_.string());
    }
    auto manifest = read_json(data_ / "manifest.json");
    for (const auto &[code, entry] : manifest.at("countries").items()) {
        auto country = std::make_unique<Country>();
        country->code = code;
        auto name = country_names.find(code);
        if (name != country_names.end()) {
            country->name = name->second;
        } else if (entry.contains("name") && entry["name"].is_string()) {
            country->name = entry["name"].get<std::string>();
        } else if (entry.contains("firms") && entry["firms"].is_string()) {
            country->name = entry["firms"].get<std::string>();
        } else {
            country->name = code;
        }
        country->summary = nlohmann::json::parse(entry.dump());
        country->summary.erase("files");
        if (manifest.contains("countries_interval_limit") && manifest["countries_interval_limit"].contains(code)) {
            country->summary["interval_limit"] =
                nlohmann::json::parse(manifest["countries_interval_limit"][code].dump());
        }
        country->bands = nlohmann::json::parse(read_json(data_ / code / "uncertainty.json").dump());
        if (!country->bands.contains("aqua") || !country->bands.contains("noaa20")) {
            throw std::runtime_error("uncertainty.json for " + code + " is missing aqua/noaa20 bands");
        }
        country->series_file = data_ / code / "series.json";
        codes_.push_back(code);
        countries_.emplace(code, std::move(country));
    }

    sqlite3 *db = connection();
    Statement cells(db, "SELECT country,cell,lat,lon,area_km2,admin FROM cells");
    while (cells.step()) {
        auto found = countries_.find(cells.text(0));
        if (found == countries_.end()) {
            continue;
        }
        Country &country = *found->second;
        double lat = cells.real(2);
        double lon = cells.real(3);
        if (!std::isfinite(lat) || !std::isfinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            throw std::runtime_error("invalid cell coordinates for " + cells.text(0) + ": " + cells.text(1));
        }
        country.index.emplace(cells.text(1), country.cells.size());
        country.cells.push_back({cells.text(1), lat, lon, cells.real(4), cells.text(5)});
    }
    for (const auto &[code, country] : countries_) {
        if (country->cells.empty()) continue;
        std::vector<std::pair<double, double>> points;
        points.reserve(country->cells.size());
        for (const auto &cell : country->cells) points.emplace_back(cell.lon, cell.lat);
        auto box = robust_bbox(std::move(points));
        country->summary["bbox"] = nlohmann::json::array({box[0], box[1], box[2], box[3]});
    }

    Statement availability(db, "SELECT country,year,month,source FROM availability");
    while (availability.step()) {
        auto found = countries_.find(availability.text(0));
        int year = availability.integer(1);
        int month = availability.integer(2);
        if (found != countries_.end() && year >= first_year && year <= last_year && month >= 1 && month <= 12) {
            found->second->source[month_index(year, month)] = availability.text(3);
        }
    }
    for (const auto &[code, country] : countries_) {
        if (country->cells.empty()) {
            throw std::runtime_error("no cells for " + code);
        }
        for (const auto &source : country->source) {
            if (source.empty()) {
                throw std::runtime_error("incomplete availability for " + code);
            }
        }
    }
}

const Country *Store::country(std::string_view code) const {
    auto found = countries_.find(code);
    return found == countries_.end() ? nullptr : found->second.get();
}

sqlite3 *Store::connection() const {
    struct Connection {
        std::filesystem::path path;
        sqlite3 *db = nullptr;
        ~Connection() { sqlite3_close(db); }
    };
    thread_local Connection current;
    if (!current.db || current.path != database_) {
        sqlite3_close(current.db);
        current.db = nullptr;
        current.db = open_read_only(database_);
        current.path = database_;
    }
    return current.db;
}

namespace {

void load_series(const Country &country) {
    std::call_once(country.series_loaded, [&country] {
        auto document = read_json(country.series_file);
        auto index = nlohmann::ordered_json::array();
        for (const auto &[id, entry] : document.items()) {
            country.series.emplace(id, entry.dump());
            nlohmann::ordered_json item{
                {"id", id}, {"name", entry.value("name", id)}, {"cells", entry.value("cells", 0)}};
            std::vector<std::pair<double, double>> points;
            for (const auto &cell : country.cells) {
                if (id != country.code && cell.admin != id) continue;
                points.emplace_back(cell.lon, cell.lat);
            }
            if (!points.empty()) {
                auto box = robust_bbox(std::move(points));
                item["bbox"] = nlohmann::ordered_json::array({box[0], box[1], box[2], box[3]});
            }
            index.push_back(std::move(item));
        }
        country.series_index = index.dump();
    });
}

}

const std::string *Store::series(const Country &country, const std::string &key) const {
    load_series(country);
    auto found = country.series.find(key);
    return found == country.series.end() ? nullptr : &found->second;
}

const std::string &Store::series_index(const Country &country) const {
    load_series(country);
    return country.series_index;
}

}

namespace ninacal {

const Activity &Store::activity(const Country &country) const {
    std::call_once(country.activity_loaded, [this, &country] {
        std::vector<std::uint32_t> cells;
        std::vector<std::uint16_t> months;
        std::vector<double> harm;
        Statement rows(connection(), "SELECT cell,year,month,harm FROM activity "
                                     "WHERE country=? AND year BETWEEN 2003 AND 2025 "
                                     "AND month BETWEEN 1 AND 12 AND harm IS NOT NULL");
        rows.bind(1, country.code);
        while (rows.step()) {
            auto found = country.index.find(rows.text(0));
            if (found == country.index.end()) {
                continue;
            }
            int month = month_index(rows.integer(1), rows.integer(2));
            if (month < 0 || month >= month_count) {
                continue;
            }
            cells.push_back(static_cast<std::uint32_t>(found->second));
            months.push_back(static_cast<std::uint16_t>(month));
            harm.push_back(rows.real(3));
        }
        Activity result;
        result.offsets.assign(country.cells.size() + 1, 0);
        for (auto cell : cells) {
            ++result.offsets[cell + 1];
        }
        for (std::size_t i = 1; i < result.offsets.size(); ++i) {
            result.offsets[i] += result.offsets[i - 1];
        }
        result.months.resize(months.size());
        result.harm.resize(harm.size());
        auto next = result.offsets;
        for (std::size_t k = 0; k < cells.size(); ++k) {
            auto position = next[cells[k]]++;
            result.months[position] = months[k];
            result.harm[position] = harm[k];
        }
        country.activity = std::move(result);
        cells = {};
        months = {};
        harm = {};
#if defined(__GLIBC__)
        malloc_trim(0);
#endif
    });
    return country.activity;
}

}
