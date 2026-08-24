#include "window_render.h"

#include "../ui_main.h"
#include "../ui/fonts.h"
#include "../ui/strings_data.h"

#include "rend_inits.h"
#include "wnd_proc.h"

#include <d3d11.h>
#include <D3DX11.h>
#pragma comment (lib, "d3dx11.lib")
#include <dwmapi.h>

#include "../ui_events.hpp"

void blur(HWND hwnd) {
    struct ACCENTPOLICY { int na; int nf; int nc; int nA; };
    struct WINCOMPATTRDATA { int na; PVOID pd; ULONG ul;};

    const HINSTANCE hm = LoadLibrary(L"user32.dll");
    if (hm)
    {
        typedef BOOL(WINAPI* pSetWindowCompositionAttribute)(HWND, WINCOMPATTRDATA*);
        const pSetWindowCompositionAttribute SetWindowCompositionAttribute = (pSetWindowCompositionAttribute)GetProcAddress(hm, "SetWindowCompositionAttribute");
        if (SetWindowCompositionAttribute)
        {
            ACCENTPOLICY policy = { 3, 0, 0, 0 };
            WINCOMPATTRDATA data = { 19, &policy,sizeof(ACCENTPOLICY) };
            SetWindowCompositionAttribute(hwnd, &data);
        }
        FreeLibrary(hm);
    }
}

static d3d11_render_inits _d3d;
void peroxide_render::initialize_window() {
    wc = { sizeof(WNDCLASSEX), CS_CLASSDC, WndProc, 0L, 0L, GetModuleHandle(NULL), NULL, NULL, NULL, NULL, 
        wnd_class_name, NULL}; ::RegisterClassEx(&wc);

    int r; srand(time(NULL)); r = rand() % peroxide_count;

    GetClientRect(GetDesktopWindow(), &pos_rect);
    pos_rect.left = (pos_rect.right / 2) - (wnd_width / 2);
    pos_rect.top = (pos_rect.bottom / 2) - (wnd_height / 2);

    main_hwnd = ::CreateWindow(wc.lpszClassName, L"peroxide.ltd", // name
    WS_POPUP, // wnd type
    pos_rect.left, pos_rect.top, // pos
    wnd_width, wnd_height, // size
    NULL, NULL, wc.hInstance, NULL);

    MARGINS margins = { -1 };
    DwmExtendFrameIntoClientArea(main_hwnd, &margins);

    blur(main_hwnd);

    if (!_d3d.create_device(main_hwnd))
    {
        _d3d.cleanup_device();
        ::UnregisterClass(wc.lpszClassName, wc.hInstance);
        exit(5);
    }

    ::ShowWindow(main_hwnd, SW_SHOWDEFAULT);
    ::UpdateWindow(main_hwnd);
}

void peroxide_render::initialize_imgui() {
    ImGui::CreateContext();
    ImGui::StyleColorsDark();

    ImGuiIO& io = ImGui::GetIO();
    io.IniFilename = nullptr;

    ui_fonts::initialize();
    
    {
        ImGuiStyle* style = &ImGui::GetStyle();
        style->WindowRounding = 8.f;
        style->ItemSpacing = ImVec2(6, 10);
    }

    ImGui_ImplWin32_Init(main_hwnd);
    ImGui_ImplDX11_Init(_d3d.get_device(), _d3d.get_device_context());
}

void peroxide_render::window_header() {
    ImGuiWindow* window = ImGui::GetCurrentWindow();
    ImVec2 pos = window->Pos;
    ImVec2 size = window->Size;
    window->DrawList->AddRectFilled(pos, ImVec2(pos.x + size.x, pos.y + 50), ImColor(0, 0, 0, 50), 9.f, ImDrawFlags_RoundCornersTop);
    window->DrawList->AddText(ui_font[e_fonts::ICONS_28], 28.f, pos + ImVec2(223, 11), IM_COL32_WHITE, "A");

    window->DrawList->AddLine(pos + ImVec2(0, 50), pos + ImVec2(size.x, 50), ImColor(255, 255, 255, 10));

    ImGui::SetCursorPos(ImVec2(size.x - 60, 20));
    ImGui::PushStyleVar(ImGuiStyleVar_ItemSpacing, ImVec2(4, 0));
    ImGui::BeginGroup(); {
        peroxide_ui::dotbutton("##empty", ImColor(0, 0, 0, 0)); ImGui::SameLine();
        if (peroxide_ui::dotbutton("##minimize", ImColor(255, 225, 0))) g_ui_events.minimize_btn();
        ImGui::SameLine();
        if (peroxide_ui::dotbutton("##close", ImColor(197, 60, 44))) g_ui_events.close_btn();
        ImGui::SameLine();
    }
    ImGui::PopStyleVar(1);
}

void peroxide_render::change_content_alpha(float value, float speed) {
    content_alpha = ImLerp(content_alpha, value, ImGui::GetIO().DeltaTime * speed);
}

bool peroxide_render::main_frame() {
    MSG msg;
    while (::PeekMessage(&msg, NULL, 0U, 0U, PM_REMOVE))
    {
        ::TranslateMessage(&msg);
        ::DispatchMessage(&msg);
        if (msg.message == WM_QUIT)
            return false;
    }

    //if (GetAsyncKeyState(VK_F5)) mainbg_alpha = 0.f, content_alpha = 0.f, sizeanim = 1.f;

    ImGui_ImplDX11_NewFrame();
    ImGui_ImplWin32_NewFrame();
    ImGui::NewFrame();

    ImGui::SetNextWindowSize({ 473 , 334 });
    ImGui::SetNextWindowPos({ 0, 0 });

    ImGui::PushStyleColor(ImGuiCol_WindowBg, ImVec4(0.f, 0.f, 0.f, 200/255.f));
    ImGui::PushStyleColor(ImGuiCol_Border, ImVec4(1.f, 1.f, 1.f, 40 / 255.f));
    ImGui::Begin("main_window", &begin_status, window_flags);

    ImGui::PushStyleVar(ImGuiStyleVar_Alpha, content_alpha); ImGuiStyle* s = &ImGui::GetStyle(); s->Alpha = content_alpha;

    window_header();

    switch (loader_page)
    {
    case login: login_area_page();
        break;
    case personal_area: personal_area_page();
        break;
    case inj_track: inj_status();
        break;
    }
    ImGui::PopStyleVar();
    ImGui::End();
    ImGui::Render();

    const float clear_color_with_alpha[4] = { 0, 0, 0, 0 }; // ui bg color
    auto rend_target_view = _d3d.get_rendertarget_v();
    _d3d.get_device_context()->OMSetRenderTargets(1, &rend_target_view, NULL);
    _d3d.get_device_context()->ClearRenderTargetView(rend_target_view, clear_color_with_alpha);
    ImGui_ImplDX11_RenderDrawData(ImGui::GetDrawData());

    _d3d.get_swapchain()->Present(1, 0);

    return true;
}

void peroxide_render::render_shutdown() {
    // imgui shutdowns
    ImGui_ImplDX11_Shutdown();
    ImGui_ImplWin32_Shutdown();
    ImGui::DestroyContext();
    // destroy window
    _d3d.cleanup_device();
    ::DestroyWindow(main_hwnd);
    ::UnregisterClass(wc.lpszClassName, wc.hInstance);

    if (exit_on_rend_shutdown) exit(0);
}

void peroxide_render::change_current_page(int num) {
    switch (num) {
        case 0: this->loader_page = login; break;
        case 1: this->loader_page = personal_area; break;
        case 2: this->loader_page = inj_track; break;
    }
}
