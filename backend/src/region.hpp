#pragma once

#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>

#include <nlohmann/json.hpp>

#include "store.hpp"

namespace ninacal {

class BadRequest : public std::runtime_error {
  public:
    using std::runtime_error::runtime_error;
};

class NotFound : public std::runtime_error {
  public:
    using std::runtime_error::runtime_error;
};

struct Box {
    double west = 0;
    double south = 0;
    double east = 0;
    double north = 0;
};

struct RegionRequest {
    std::string country;
    std::optional<Box> box;
    std::optional<nlohmann::json> polygon;
    int start = harmonized_first_year;
    int end = last_year;
};

Box parse_box(std::string_view text);
Box box_from_json(const nlohmann::json &values);
const Country &require_country(const Store &store, std::string_view code);
std::vector<bool> select_cells(const Country &country, const std::optional<Box> &box, const nlohmann::json *polygon);
nlohmann::ordered_json region(const Store &store, const RegionRequest &request);
nlohmann::ordered_json grid(const Store &store, const Country &country, int year, int month,
                            const std::optional<Box> &box);
std::string months_csv(const nlohmann::ordered_json &result);
std::string cells_csv(const Store &store, const RegionRequest &request);

}
