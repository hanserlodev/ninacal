#include "region.hpp"

#include <algorithm>
#include <array>
#include <charconv>
#include <cmath>
#include <locale>
#include <iomanip>
#include <sstream>

namespace ninacal {

namespace {

using Ring = std::vector<std::array<double, 2>>;

constexpr double anomaly_scale = 0.67448975;

void validate(const Box &box) {
    for (double value : {box.west, box.south, box.east, box.north}) {
        if (!std::isfinite(value)) {
            throw BadRequest("Invalid WGS84 bounding box");
        }
    }
    if (!(-90 <= box.south && box.south < box.north && box.north <= 90 && -180 <= box.west && box.west <= 180 &&
          -180 <= box.east && box.east <= 180 && box.west != box.east)) {
        throw BadRequest("Invalid WGS84 bounding box");
    }
}

bool in_box(const Box &box, double lon, double lat) {
    bool horizontal = box.west < box.east ? lon >= box.west && lon < box.east : lon >= box.west || lon < box.east;
    return horizontal && lat >= box.south && lat < box.north;
}

double wrap(double longitude) {
    double result = std::fmod(longitude, 360.0);
    return result < 0 ? result + 360.0 : result;
}

Ring parse_ring(const nlohmann::json &positions) {
    if (!positions.is_array() || positions.size() < 3) {
        throw BadRequest("Each polygon ring needs at least three positions");
    }
    Ring ring;
    ring.reserve(positions.size());
    for (const auto &position : positions) {
        if (!position.is_array() || position.size() < 2 || !position[0].is_number() || !position[1].is_number()) {
            throw BadRequest("Polygon positions must be [longitude, latitude] numbers");
        }
        ring.push_back({position[0].get<double>(), position[1].get<double>()});
    }
    return ring;
}

bool inside(const Ring &ring, double x, double y) {
    bool result = false;
    for (std::size_t i = 0, j = ring.size() - 1; i < ring.size(); j = i++) {
        double xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
        if ((yi > y) != (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) {
            result = !result;
        }
    }
    return result;
}

std::vector<bool> polygon_mask(const Country &country, const nlohmann::json &input) {
    const nlohmann::json *geometry = &input;
    if (geometry->is_object() && geometry->value("type", "") == "Feature") {
        geometry = &geometry->at("geometry");
    }
    std::string type = geometry->is_object() ? geometry->value("type", "") : "";
    if (type != "Polygon" && type != "MultiPolygon") {
        throw BadRequest("Expected a GeoJSON Polygon or MultiPolygon");
    }
    const auto &coordinates = geometry->at("coordinates");
    if (!coordinates.is_array() || coordinates.empty()) {
        throw BadRequest("Polygon coordinates are empty");
    }
    std::vector<nlohmann::json> polygons;
    if (type == "MultiPolygon") {
        polygons.assign(coordinates.begin(), coordinates.end());
    } else {
        polygons.push_back(coordinates);
    }
    std::vector<bool> result(country.cells.size(), false);
    for (const auto &rings : polygons) {
        if (!rings.is_array() || rings.empty()) {
            throw BadRequest("Polygon without rings");
        }
        Ring exterior = parse_ring(rings[0]);
        auto [low, high] = std::minmax_element(exterior.begin(), exterior.end(),
                                               [](const auto &a, const auto &b) { return a[0] < b[0]; });
        bool crossing = (*high)[0] - (*low)[0] > 180;
        std::vector<Ring> holes;
        for (std::size_t r = 1; r < rings.size(); ++r) {
            holes.push_back(parse_ring(rings[r]));
        }
        if (crossing) {
            for (auto &position : exterior) {
                position[0] = wrap(position[0]);
            }
            for (auto &hole : holes) {
                for (auto &position : hole) {
                    position[0] = wrap(position[0]);
                }
            }
        }
        for (std::size_t i = 0; i < country.cells.size(); ++i) {
            if (result[i]) {
                continue;
            }
            const Cell &cell = country.cells[i];
            double lon = crossing ? wrap(cell.lon) : cell.lon;
            bool selected = inside(exterior, lon, cell.lat);
            for (const auto &hole : holes) {
                selected = selected && !inside(hole, lon, cell.lat);
            }
            result[i] = selected;
        }
    }
    return result;
}

double median(std::vector<double> values) {
    std::sort(values.begin(), values.end());
    std::size_t n = values.size();
    return n % 2 ? values[n / 2] : (values[n / 2 - 1] + values[n / 2]) / 2;
}

void anomaly(nlohmann::ordered_json &row, std::optional<double> value, const std::vector<double> &history) {
    if (!value || history.size() < 5) {
        row["median"] = nullptr;
        row["anomaly_mad"] = nullptr;
        row["reference_years"] = value ? history.size() : 0;
        return;
    }
    double center = median(history);
    std::vector<double> deviations;
    deviations.reserve(history.size());
    for (double h : history) {
        deviations.push_back(std::abs(h - center));
    }
    double mad = median(deviations);
    row["median"] = center;
    row["anomaly_mad"] = mad > 0 ? nlohmann::ordered_json(anomaly_scale * (*value - center) / mad) : nullptr;
    row["reference_years"] = history.size();
}

int edges_below(const nlohmann::json &edges, double value) {
    int count = 0;
    for (const auto &edge : edges) {
        if (edge.get<double>() < value) {
            ++count;
        }
    }
    return count;
}

void band(nlohmann::ordered_json &row, double value, std::size_t cells, const nlohmann::json &bank) {
    row["low"] = nullptr;
    row["high"] = nullptr;
    row["band_group"] = nullptr;
    if (!bank.is_object() || !bank.contains("tables") || !bank["tables"].contains("monthly")) {
        return;
    }
    const auto &table = bank["tables"]["monthly"];
    int c = edges_below(bank.at("count_edges"), static_cast<double>(cells));
    int v = edges_below(bank.at("value_edges"), value);
    double phi = 0.0;
    if (bank.contains("phi") && bank["phi"].contains("monthly")) {
        const auto &phis = bank["phi"]["monthly"];
        auto exact = phis.find(std::to_string(c));
        phi = exact != phis.end() ? exact->get<double>() : phis.value("*", 0.0);
    }
    double width = std::sqrt(value + 1 + phi * value * value);
    for (const auto &key : {std::to_string(c) + ":" + std::to_string(v), std::to_string(c) + ":*",
                            "*:" + std::to_string(v), std::string("*:*")}) {
        auto found = table.find(key);
        if (found != table.end()) {
            double low = std::max(0.0, value + found->at("q10").get<double>() * width);
            double high = std::max(low, value + found->at("q90").get<double>() * width);
            row["low"] = low;
            row["high"] = high;
            row["band_group"] = key;
            return;
        }
    }
}

bool excluded(const std::string &source) {
    return source == "not_harmonized" || source == "unavailable";
}

}

Box parse_box(std::string_view text) {
    std::array<double, 4> values{};
    std::size_t position = 0;
    for (std::size_t i = 0; i < values.size(); ++i) {
        std::size_t comma = text.find(',', position);
        std::string_view part = text.substr(position, comma == std::string_view::npos ? text.npos : comma - position);
        auto [end, error] = std::from_chars(part.data(), part.data() + part.size(), values[i]);
        if (error != std::errc{} || end != part.data() + part.size() || (i < 3) == (comma == text.npos)) {
            throw BadRequest("bbox must be west,south,east,north");
        }
        position = comma + 1;
    }
    Box box{values[0], values[1], values[2], values[3]};
    validate(box);
    return box;
}

Box box_from_json(const nlohmann::json &values) {
    if (!values.is_array() || values.size() != 4) {
        throw BadRequest("bbox must be [west, south, east, north]");
    }
    for (const auto &value : values) {
        if (!value.is_number()) {
            throw BadRequest("bbox must be [west, south, east, north]");
        }
    }
    Box box{values[0].get<double>(), values[1].get<double>(), values[2].get<double>(), values[3].get<double>()};
    validate(box);
    return box;
}

const Country &require_country(const Store &store, std::string_view code) {
    const Country *country = store.country(code);
    if (!country) {
        throw NotFound("Unsupported country: " + std::string(code));
    }
    return *country;
}

std::vector<bool> select_cells(const Country &country, const std::optional<Box> &box, const nlohmann::json *polygon) {
    std::vector<bool> mask(country.cells.size(), true);
    if (box) {
        for (std::size_t i = 0; i < country.cells.size(); ++i) {
            mask[i] = in_box(*box, country.cells[i].lon, country.cells[i].lat);
        }
    }
    if (polygon) {
        auto inside_polygon = polygon_mask(country, *polygon);
        for (std::size_t i = 0; i < mask.size(); ++i) {
            mask[i] = mask[i] && inside_polygon[i];
        }
    }
    return mask;
}

nlohmann::ordered_json region(const Store &store, const RegionRequest &request) {
    if (!(harmonized_first_year <= request.start && request.start <= request.end && request.end <= last_year)) {
        throw BadRequest("The harmonized interval must be within 2003-2025");
    }
    const Country &country = require_country(store, request.country);
    auto mask = select_cells(country, request.box, request.polygon ? &*request.polygon : nullptr);
    std::vector<std::size_t> chosen;
    double area = 0;
    for (std::size_t i = 0; i < mask.size(); ++i) {
        if (mask[i]) {
            chosen.push_back(i);
            area += country.cells[i].area_km2;
        }
    }
    nlohmann::ordered_json result;
    result["country"] = country.code;
    result["cells"] = chosen.size();
    if (chosen.empty()) {
        result["status"] = "outside_published_support";
        result["months"] = nlohmann::ordered_json::array();
        return result;
    }

    const Activity &activity = store.activity(country);
    std::vector<double> totals(month_count, 0.0);
    for (std::size_t i : chosen) {
        for (auto k = activity.offsets[i]; k < activity.offsets[i + 1]; ++k) {
            totals[activity.months[k]] += activity.harm[k];
        }
    }

    auto months = nlohmann::ordered_json::array();
    for (int year = request.start; year <= request.end; ++year) {
        for (int month = 1; month <= 12; ++month) {
            int t = month_index(year, month);
            const std::string &source = country.source[t];
            std::optional<double> value;
            if (!excluded(source)) {
                value = totals[t];
            }
            nlohmann::ordered_json row;
            row["year"] = year;
            row["month"] = month;
            row["value"] = value ? nlohmann::ordered_json(*value) : nullptr;
            row["low"] = nullptr;
            row["high"] = nullptr;
            row["source"] = source;
            row["band_group"] = nullptr;
            if (value && source != "snpp_observed") {
                band(row, *value, chosen.size(), country.bands.at(source == "aqua_estimated" ? "aqua" : "noaa20"));
            }
            std::vector<double> history;
            for (int prior = harmonized_first_year; prior < year; ++prior) {
                int p = month_index(prior, month);
                if (!excluded(country.source[p])) {
                    history.push_back(totals[p]);
                }
            }
            anomaly(row, value, history);
            months.push_back(std::move(row));
        }
    }
    // Stable map scale: 98th percentile of each selected cell's best year.
    // Computed from the same activity table so playback keeps one color scale.
    std::vector<double> cell_peaks;
    cell_peaks.reserve(chosen.size());
    for (std::size_t i : chosen) {
        std::array<double, last_year - first_year + 1> yearly{};
        for (auto k = activity.offsets[i]; k < activity.offsets[i + 1]; ++k) {
            int t = activity.months[k];
            int y = t / 12 + first_year;
            if (y >= request.start && y <= request.end && !excluded(country.source[t])) {
                yearly[static_cast<std::size_t>(y - first_year)] += activity.harm[k];
            }
        }
        double peak = 0.0;
        for (double value : yearly) {
            peak = std::max(peak, value);
        }
        cell_peaks.push_back(peak);
    }
    double cell_year_p98 = 1.0;
    if (!cell_peaks.empty()) {
        std::sort(cell_peaks.begin(), cell_peaks.end());
        cell_year_p98 = std::max(1.0, cell_peaks[std::min(cell_peaks.size() - 1,
                                                          static_cast<std::size_t>((cell_peaks.size() - 1) * 0.98))]);
    }

    result["cell_center_selection"] = true;
    result["support_area_km2"] = area;
    result["cell_year_p98"] = cell_year_p98;
    result["observation_coverage"] = "unknown";
    result["interval_status"] = "exploratory_not_validated";
    result["months"] = std::move(months);
    return result;
}

nlohmann::ordered_json grid(const Store &store, const Country &country, int year, int month,
                            const std::optional<Box> &box) {
    if (year < first_year || year > last_year || month < 0 || month > 12) {
        throw BadRequest("year must be 2000-2025 and month 0 (whole year) or 1-12");
    }
    Statement cells(store.connection(),
                    month == 0
                        ? "SELECT cell,SUM(harm) FROM activity WHERE country=? AND year=? GROUP BY cell"
                        : "SELECT cell,harm FROM activity WHERE country=? AND year=? AND month=?");
    cells.bind(1, country.code).bind(2, year);
    if (month != 0) {
        cells.bind(3, month);
    }
    auto rows = nlohmann::ordered_json::array();
    while (cells.step()) {
        auto found = country.index.find(cells.text(0));
        if (found == country.index.end()) {
            continue;
        }
        const Cell &cell = country.cells[found->second];
        if (box && !in_box(*box, cell.lon, cell.lat)) {
            continue;
        }
        auto harm = cells.null(1) ? nlohmann::ordered_json() : nlohmann::ordered_json(cells.real(1));
        rows.push_back(nlohmann::ordered_json::array({cell.id, cell.lat, cell.lon, std::move(harm)}));
    }

    std::string source;
    if (month == 0) {
        bool partial = false;
        std::string first;
        for (int m = 1; m <= 12; ++m) {
            const std::string &value = country.source[month_index(year, m)];
            if (excluded(value)) {
                partial = true;
            } else if (first.empty()) {
                first = value;
            } else if (first != value) {
                first = "mixed";
            }
        }
        source = partial ? "partial" : (first.empty() ? "unavailable" : first);
    } else {
        source = country.source[month_index(year, month)];
    }

    nlohmann::ordered_json result;
    result["country"] = country.code;
    result["year"] = year;
    result["month"] = month;
    result["source"] = source;
    result["unit"] = "detected cell-days, Suomi NPP equivalent";
    result["sparse"] = "published cells not listed have 0";
    result["columns"] = {"cell", "lat", "lon", "harm"};
    result["rows"] = std::move(rows);
    return result;
}

std::string cells_csv(const Store &store, const RegionRequest &request) {
    const Country &country = require_country(store, request.country);
    auto mask = select_cells(country, request.box, request.polygon ? &*request.polygon : nullptr);
    const Activity &activity = store.activity(country);
    std::ostringstream csv;
    csv.imbue(std::locale::classic());
    csv << "cell,lat,lon,year,month,hotspot_days,source\n";
    std::size_t rows = 0;
    for (std::size_t i = 0; i < mask.size(); ++i) {
        if (!mask[i]) continue;
        const Cell &cell = country.cells[i];
        for (auto k = activity.offsets[i]; k < activity.offsets[i + 1]; ++k) {
            int t = activity.months[k];
            int year = t / 12 + first_year;
            if (year < request.start || year > request.end) continue;
            const std::string &source = country.source[t];
            if (excluded(source)) continue;
            double value = activity.harm[k];
            if (!(value > 0)) continue;
            if (++rows > 4000000) {
                throw BadRequest("selection too large for a cell CSV; draw a smaller area or reduce the years");
            }
            csv << cell.id << ',' << std::fixed << std::setprecision(2) << cell.lat << ',' << cell.lon << ','
                << year << ',' << (t % 12 + 1) << ',' << std::setprecision(6) << value << ','
                << source << '\n';
        }
    }
    return csv.str();
}

std::string months_csv(const nlohmann::ordered_json &result) {
    const auto &months = result.at("months");
    if (months.empty()) {
        return "";
    }
    std::string csv;
    bool first = true;
    for (const auto &[key, _] : months[0].items()) {
        csv += (first ? "" : ",") + key;
        first = false;
    }
    csv += "\n";
    for (const auto &row : months) {
        first = true;
        for (const auto &[_, value] : row.items()) {
            if (!first) {
                csv += ",";
            }
            first = false;
            if (value.is_string()) {
                csv += value.get<std::string>();
            } else if (!value.is_null()) {
                csv += value.dump();
            }
        }
        csv += "\n";
    }
    return csv;
}

}
