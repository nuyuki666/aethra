#pragma once
#include "imgui.h"
#include "imgui_impl_dx11.h"
#include "imgui_internal.h"
#include "imgui_impl_win32.h"
#include <d3d11.h>
#include <windows.h>
#include <time.h>
#include <thread>

#define wnd_class_name L"0LfQsNGH0LXQvCDQutGA0Y/QutCw0YLRjCDQutC+0LPQtNCwINC80L7QttC90L4g0LzRj9GD0LrQsNGC0Yw/"

class peroxide_render {
public:
	bool main_frame();
    enum loader_c_page {
        login, personal_area, inj_track
    } loader_page;
    void change_current_page(int num);

	void initialize_window();
	void initialize_imgui();
    void render_shutdown();

    void change_content_alpha(float value, float speed);

    void window_header();

    float mainbg_alpha = 0.f;
    float content_alpha = 0.f;

    float sizeanim = 1.f;
    int current_theme = 1;

    ID3D11ShaderResourceView* bg_image_login = nullptr;

	HWND main_hwnd;
private:
    WNDCLASSEX wc;

    RECT pos_rect;
    int wnd_width = 473;
    int wnd_height = 334;

    DWORD window_flags = ImGuiWindowFlags_NoDecoration 
    | ImGuiWindowFlags_NoMove 
    | ImGuiWindowFlags_NoScrollWithMouse;
    bool use_random_wnd_title = true;
    bool begin_status = true;
    bool exit_on_rend_shutdown = true;
};

struct TickCountClock
{
    typedef unsigned long long                       rep;
    typedef std::milli                               period;
    typedef std::chrono::duration<rep, period>       duration;
    typedef std::chrono::time_point<TickCountClock>  time_point;
    static const bool is_steady = true;

    static time_point now() noexcept
    {
        return time_point(duration(GetTickCount()));
    }
};