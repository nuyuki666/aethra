#pragma once
#include "../ui_main.h"
#include <Lmcons.h>

class c_user {

public:
	char user[32];
	char password[32];
	struct {
		bool banned = false;
		bool hwid_missmatch = false;
	} errors;

	c_user() : user("\0\0\0 "), password("\0\0\0 "), errors() {}
};

c_user g_user;