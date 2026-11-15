#include <charconv>
#include <chrono>
#include <cstdlib>
#include <exception>
#include <filesystem>
#include <iostream>
#include <string>
#include <string_view>
#include <thread>

#include <httplib.h>
#include <nlohmann/json.hpp>

#include "region.hpp"
#include "store.hpp"

namespace {

struct Options {
    std::filesystem::path database = "data/derived/v2/ninacal.sqlite";
    std::filesystem::path data = "web/data/v2";
    std::string host = "127.0.0.1";
    int port = 8080;
    int threads = static_cast<int>(std::max(2u, std::thread::hardware_concurrency()));
};

constexpr std::string_view usage =
    "usage: ninacal-server [--db PATH] [--data DIR] [--host HOST] [--port PORT] [--threads N]\n";

int to_int(std::string_view text, std::string_view name) {
    int value = 0;
    auto [end, error] = std::from_chars(text.data(), text.data() + text.size(), value);
    if (error != std::errc{} || end != text.data() + text.size()) {
        throw ninacal::BadRequest(std::string(name) + " must be an integer");
    }
    return value;
}

Options parse(int argc, char **argv) {
    Options options;
    for (int i = 1; i < argc; ++i) {
        std::string_view flag = argv[i];
        if (flag == "--help" || flag == "-h") {
            std::cout << usage;
            std::exit(0);
        }
        if (i + 1 >= argc) {
            throw std::runtime_error("missing value for " + std::string(flag));
        }
        std::string value = argv[++i];
        if (flag == "--db") {
            options.database = value;
        } else if (flag == "--data") {
            options.data = value;
        } else if (flag == "--host") {
            options.host = value;
        } else if (flag == "--port") {
            options.port = to_int(value, "--port");
        } else if (flag == "--threads") {
            options.threads = std::max(1, to_int(value, "--threads"));
        } else {
            throw std::runtime_error("unknown option " + std::string(flag));
        }
    }
    return options;
}

void send_json(httplib::Response &response, const nlohmann::ordered_json &body) {
    response.set_content(body.dump(-1, ' ', false, nlohmann::json::error_handler_t::replace), "application/json");
}

void send_error(httplib::Response &response, int status, const std::string &message) {
    response.status = status;
    send_json(response, {{"error", message}});
}

int integer_parameter(const httplib::Request &request, const char *name, int fallback) {
    return request.has_param(name) ? to_int(request.get_param_value(name), name) : fallback;
}

std::optional<ninacal::Box> box_parameter(const httplib::Request &request) {
    if (!request.has_param("bbox")) {
        return std::nullopt;
    }
    return ninacal::parse_box(request.get_param_value("bbox"));
}

void send_region(const httplib::Request &request, httplib::Response &response, const ninacal::Store &store,
                 const ninacal::RegionRequest &query) {
    std::string format = request.has_param("format") ? request.get_param_value("format") : "json";
    if (format == "cells") {
        response.set_header("Content-Disposition", "attachment; filename=\"ninacal_hotspots_" + query.country + "_" +
                                                       std::to_string(query.start) + "_" + std::to_string(query.end) +
                                                       ".csv\"");
        response.set_content(ninacal::cells_csv(store, query), "text/csv");
        return;
    }
    auto result = ninacal::region(store, query);
    if (format == "csv") {
        response.set_header("Content-Disposition", "attachment; filename=\"ninacal_" + query.country + "_" +
                                                       std::to_string(query.start) + "_" + std::to_string(query.end) +
                                                       ".csv\"");
        response.set_content(ninacal::months_csv(result), "text/csv");
    } else if (format == "json") {
        send_json(response, result);
    } else {
        throw ninacal::BadRequest("format must be json, csv or cells");
    }
}

void routes(httplib::Server &server, const ninacal::Store &store) {
    server.Get("/health", [&store](const httplib::Request &, httplib::Response &response) {
        send_json(response, {{"status", "ok"}, {"countries", store.codes().size()}});
    });

    server.Get("/api/countries", [&store](const httplib::Request &, httplib::Response &response) {
        auto list = nlohmann::ordered_json::array();
        for (const auto &code : store.codes()) {
            const auto &country = *store.country(code);
            nlohmann::ordered_json entry{{"code", country.code}, {"name", country.name}};
            for (const auto &[key, value] : country.summary.items()) {
                entry[key] = value;
            }
            list.push_back(std::move(entry));
        }
        send_json(response, list);
    });

    server.Get(R"(/api/series/([A-Za-z]{2,3}))", [&store](const httplib::Request &request, httplib::Response &response) {
        const auto &country = ninacal::require_country(store, request.matches[1].str());
        response.set_content(store.series_index(country), "application/json");
    });

    server.Get(R"(/api/series/([A-Za-z]{2,3})/([^/]+))",
               [&store](const httplib::Request &request, httplib::Response &response) {
                   const auto &country = ninacal::require_country(store, request.matches[1].str());
                   std::string id = request.matches[2].str();
                   const std::string *entry = store.series(country, id);
                   if (!entry) {
                       throw ninacal::NotFound("Unknown series " + id + "; list them at /api/series/" + country.code);
                   }
                   if (!request.has_param("level")) {
                       response.set_content(*entry, "application/json");
                       return;
                   }
                   std::string level = request.get_param_value("level");
                   if (level != "months" && level != "quarters" && level != "years") {
                       throw ninacal::BadRequest("level must be months, quarters or years");
                   }
                   auto parsed = nlohmann::ordered_json::parse(*entry);
                   nlohmann::ordered_json body{{"id", id},
                                               {"name", parsed.value("name", id)},
                                               {"cells", parsed.value("cells", 0)},
                                               {"interval_status", parsed.value("interval_status", "")},
                                               {"level", level},
                                               {"rows", parsed.at(level)}};
                   send_json(response, body);
               });

    server.Get(R"(/api/grid/([A-Za-z]{2,3}))", [&store](const httplib::Request &request, httplib::Response &response) {
        const auto &country = ninacal::require_country(store, request.matches[1].str());
        if (!request.has_param("year")) {
            throw ninacal::BadRequest("year is required");
        }
        send_json(response, ninacal::grid(store, country, integer_parameter(request, "year", 0),
                                          integer_parameter(request, "month", 0), box_parameter(request)));
    });

    server.Get("/api/region", [&store](const httplib::Request &request, httplib::Response &response) {
        if (!request.has_param("country")) {
            throw ninacal::BadRequest("country is required");
        }
        ninacal::RegionRequest query;
        query.country = request.get_param_value("country");
        query.box = box_parameter(request);
        query.start = integer_parameter(request, "start", ninacal::harmonized_first_year);
        query.end = integer_parameter(request, "end", ninacal::last_year);
        send_region(request, response, store, query);
    });

    server.Post("/api/region", [&store](const httplib::Request &request, httplib::Response &response) {
        nlohmann::json body;
        try {
            body = nlohmann::json::parse(request.body);
        } catch (const nlohmann::json::parse_error &) {
            throw ninacal::BadRequest("body must be JSON");
        }
        if (!body.is_object() || !body.contains("country") || !body["country"].is_string()) {
            throw ninacal::BadRequest("body needs a country code");
        }
        ninacal::RegionRequest query;
        query.country = body["country"].get<std::string>();
        if (body.contains("bbox") && !body["bbox"].is_null()) {
            query.box = ninacal::box_from_json(body["bbox"]);
        }
        if (body.contains("polygon") && !body["polygon"].is_null()) {
            query.polygon = body["polygon"];
        }
        auto year = [&body](const char *name, int fallback) {
            if (!body.contains(name)) {
                return fallback;
            }
            if (!body[name].is_number_integer()) {
                throw ninacal::BadRequest(std::string(name) + " must be an integer");
            }
            return body[name].get<int>();
        };
        query.start = year("start", ninacal::harmonized_first_year);
        query.end = year("end", ninacal::last_year);
        send_region(request, response, store, query);
    });
}

}

int main(int argc, char **argv) {
    Options options;
    try {
        options = parse(argc, argv);
    } catch (const std::exception &error) {
        std::cerr << error.what() << "\n" << usage;
        return 2;
    }

    std::unique_ptr<ninacal::Store> store;
    try {
        auto started = std::chrono::steady_clock::now();
        store = std::make_unique<ninacal::Store>(options.database, options.data);
        auto elapsed = std::chrono::duration<double>(std::chrono::steady_clock::now() - started).count();
        std::cerr << "loaded " << store->codes().size() << " countries in " << elapsed << " s\n";
    } catch (const std::exception &error) {
        std::cerr << "startup failed: " << error.what() << "\n";
        return 1;
    }

    httplib::Server server;
    int threads = options.threads;
    server.new_task_queue = [threads] { return new httplib::ThreadPool(threads); };
    server.set_payload_max_length(8 * 1024 * 1024);
    server.set_default_headers({{"Access-Control-Allow-Origin", "*"},
                                {"Access-Control-Allow-Methods", "GET, POST, OPTIONS"},
                                {"Access-Control-Allow-Headers", "Content-Type"},
                                {"Access-Control-Max-Age", "86400"},
                                {"Cache-Control", "public, max-age=300"}});
    server.set_file_extension_and_mimetype_mapping("gz", "application/gzip");
    server.set_file_extension_and_mimetype_mapping("json", "application/json");
    if (!server.set_mount_point("/data", options.data.string())) {
        std::cerr << "cannot serve " << options.data << "\n";
        return 1;
    }
    server.Options(R"(.*)", [](const httplib::Request &, httplib::Response &response) { response.status = 204; });
    server.set_exception_handler([](const httplib::Request &, httplib::Response &response, std::exception_ptr error) {
        try {
            std::rethrow_exception(error);
        } catch (const ninacal::BadRequest &e) {
            send_error(response, 400, e.what());
        } catch (const ninacal::NotFound &e) {
            send_error(response, 404, e.what());
        } catch (const nlohmann::json::exception &e) {
            send_error(response, 400, e.what());
        } catch (const std::exception &e) {
            send_error(response, 500, e.what());
        } catch (...) {
            send_error(response, 500, "unknown error");
        }
    });
    server.set_error_handler([](const httplib::Request &, httplib::Response &response) {
        if (response.body.empty()) {
            send_error(response, response.status, response.status == 404 ? "Not found" : "Request failed");
        }
    });
    server.set_logger([](const httplib::Request &request, const httplib::Response &response) {
        std::cerr << response.status << " " << request.method << " " << request.path << "\n";
    });

    routes(server, *store);
    std::cerr << "listening on http://" << options.host << ":" << options.port << "\n";
    if (!server.listen(options.host, options.port)) {
        std::cerr << "cannot listen on " << options.host << ":" << options.port << "\n";
        return 1;
    }
    return 0;
}
