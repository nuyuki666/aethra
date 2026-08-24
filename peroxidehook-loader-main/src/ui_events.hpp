#pragma once
#include <windows.h>
#include "render/window_render.h"
#include "c_product.hpp"

extern peroxide_render main_render;

class c_ui_events {
public: // main functions
	void inject_btn() {
		// if (product.hours <= 0) return;
		// if (product...) . . .
		// idk
		//MessageBoxA(0, "Injected.", "Peroxide.LTD", MB_OK);
		//exit(0);
		main_render.change_current_page(2);
		main_render.content_alpha = 0.f;
		return;
	}


public: // basic
	void close_btn() {
		exit(0);
	}
	void minimize_btn() {
		ShowWindow(main_render.main_hwnd, SW_MINIMIZE);
	}
};

c_ui_events g_ui_events;