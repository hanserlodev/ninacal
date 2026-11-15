#pragma once

#include <array>
#include <cstdint>
#include <filesystem>
#include <map>
#include <memory>
#include <mutex>
#include <string>
#include <string_view>
#include <unordered_map>
#include <vector>

#include <nlohmann/json.hpp>
#include <sqlite3.h>

namespace ninacal {

inline constexpr int first_year = 2000;
inline constexpr int harmonized_first_year = 2003;
inline constexpr int last_year = 2025;
inline constexpr int month_count = (last_year - first_year + 1) * 12;

inline int month_index(int year, int month) {
    return (year - first_year) * 12 + month - 1;
}

struct Cell {
    std::string id;
    double lat = 0;
    double lon = 0;
    double area_km2 = 0;
    std::string admin;
};

struct Activity {
    std::vector<std::uint32_t> offsets;
    std::vector<std::uint16_t> months;
    std::vector<double> harm;
};

struct Country {
    std::string code;
    std::string name;
    std::vector<Cell> cells;
    std::unordered_map<std::string, std::size_t> index;
    std::array<std::string, month_count> source;
    nlohmann::json bands;
    nlohmann::json summary;
    std::filesystem::path series_file;
    mutable std::once_flag series_loaded;
    mutable std::unordered_map<std::string, std::string> series;
    mutable std::string series_index;
    mutable std::once_flag activity_loaded;
    mutable Activity activity;
};

class Statement {
  public:
    Statement(sqlite3 *db, std::string_view sql);
    ~Statement();
    Statement(const Statement &) = delete;
    Statement &operator=(const Statement &) = delete;

    Statement &bind(int index, std::string_view text);
    Statement &bind(int index, int value);
    bool step();
    void reset();

    [[nodiscard]] bool null(int column) const;
    [[nodiscard]] int integer(int column) const;
    [[nodiscard]] double real(int column) const;
    [[nodiscard]] std::string text(int column) const;

  private:
    sqlite3 *db_;
    sqlite3_stmt *statement_ = nullptr;
};

class Store {
  public:
    Store(std::filesystem::path database, std::filesystem::path data);

    [[nodiscard]] const Country *country(std::string_view code) const;
    [[nodiscard]] const std::vector<std::string> &codes() const { return codes_; }
    [[nodiscard]] const std::filesystem::path &data() const { return data_; }
    [[nodiscard]] sqlite3 *connection() const;
    [[nodiscard]] const std::string *series(const Country &country, const std::string &key) const;
    [[nodiscard]] const std::string &series_index(const Country &country) const;
    [[nodiscard]] const Activity &activity(const Country &country) const;

  private:
    std::filesystem::path database_;
    std::filesystem::path data_;
    std::vector<std::string> codes_;
    std::map<std::string, std::unique_ptr<Country>, std::less<>> countries_;
};

}
