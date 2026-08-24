#pragma once
#include <string>
#include <vector>

enum e_build_ver {
	debug, dev, alpha, beta, rc, release
};

class c_product {
public:
	int id;
	const char* tab_name;
	const char* game_name;
	e_build_ver build_id;
	int hours;

	c_product(int _id, const char* _tab_name, const char* _game_name, e_build_ver _build_id, int _hours)
		: id(_id), tab_name(_tab_name), game_name(_game_name), build_id(_build_id), hours(_hours) {}
};

//c_product rage_mp;

//std::vector<c_product> g_products = { rage_mp };
