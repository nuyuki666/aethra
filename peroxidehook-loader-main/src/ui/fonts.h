#pragma once

#define IMGUI_DEFINE_MATH_OPERATORS
#include "imgui.h"
#include "imgui_internal.h"

// main fonts
enum e_fonts {
	INTER_14, INTER_16, INTER_18, INTER_20,
	ICONS_16, ICONS_18, ICONS_28
};

extern ImFont* ui_font[6];

namespace ui_fonts {
	void initialize();
}

#define _calc_text_size(font, size, text) font->CalcTextSizeA(static_cast<float>(size), FLT_MAX, 0.0f, text)