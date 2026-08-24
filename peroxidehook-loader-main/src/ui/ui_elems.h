#pragma once
#include <cstdint>
#include <algorithm>
#include <iostream>
#include <iomanip>
#include <map>

#include "imgui.h"
#define IMGUI_DEFINE_MATH_OPERATORS
#include "imgui_internal.h"

struct element_state_t {
	bool hovered, pressed, held;
};

extern ImFont* peroxide_icons;
extern ImFont* standard;
extern ImFont* inputbox_regular;
extern ImFont* pass_glyphs;

struct button_anim { float frame, grd, text_glow; };
struct dotbutton_anim { float outline_op; };
struct checkbox_animation { float animation, text_anim; };
struct tab_elements { float frame_, ico_; };

struct s_tab_animation {
	float rect_op, text_op, line_op;
	float text_pos_x;
};

namespace peroxide_ui {
	enum e_btn_style { radial_white, trans_black };
	bool button(const char* label, const ImVec2& size_arg, e_btn_style btn_style);
	bool dotbutton(const char* label, ImColor col);
	bool input(const char* name, const char* hint, char buf[], size_t buf_size, float width, ImGuiInputTextFlags womp = 0);
	bool checkbox(const char* label, bool* v);
	bool tab(const char* label, bool boolean);
}