#pragma once
#include <windows.h>
#include <map>

#define IMGUI_DEFINE_MATH_OPERATORS
#include "imgui.h"
#include "imgui_internal.h"

#include "ui/styles.hpp"
#include "ui/fonts.h"
#include "ui/ui_elems.h"

#include "c_product.hpp"
#include "user_class.h"
#include "ui_events.hpp"

#pragma comment(lib, "wininet")
#pragma comment (lib, "urlmon.lib")

#include <cstdlib>

extern peroxide_render main_render;

void login_area_page()
{	
    ImGuiStyle* s = &ImGui::GetStyle();

    static bool swithcing_tab = false;
    if (!swithcing_tab) main_render.change_content_alpha(1.f, 3.f); else main_render.change_content_alpha(0.f, 14.f);

    ImGui::PushStyleVar(ImGuiStyleVar_ItemSpacing, 10.f);

    ImGui::SetCursorPos(ImVec2(140, 137));
    ImGui::BeginGroup(); {
        peroxide_ui::input("##userfield", "Username", g_user.user, sizeof(g_user.user), 193);
        peroxide_ui::input("##passfield", "Password", g_user.password, sizeof(g_user.password), 193, ImGuiInputTextFlags_Password);

        if (peroxide_ui::button("Sign In", { 193, 27 }, peroxide_ui::radial_white) || (ImGui::IsKeyPressed(ImGuiKey_Enter, true) && (ImGui::GetActiveID() == ImGui::GetID("##passfield")))) {
            swithcing_tab = true;

            if (main_render.content_alpha < 0.01f) {
                main_render.change_current_page(1);
                main_render.content_alpha = 0.f;
            }
        }

        if (main_render.content_alpha < 0.01f && swithcing_tab) {
            main_render.change_current_page(1);
            main_render.content_alpha = 0.f;
        }
    } ImGui::EndGroup();
}

void draw_product(const char* name, const char* ver, int status_id, const char* till_expiry) {
    ImGuiWindow* window = ImGui::GetCurrentWindow();
    ImVec2 pos = window->Pos;
    ImVec2 size = window->Size;
    ImGuiStyle* s = &ImGui::GetStyle();

    auto draw_text_row = [&](const char* text1, const char* text2, ImVec4 col_sec = ImVec4(1.f,1.f,1.f,1.f)) {
        ImVec2 text_size = _calc_text_size(ui_font[e_fonts::INTER_14], 14.f, text2);
        ImGui::TextColored(ImVec4(0.54f, 0.54f, 0.54f, 1.f * s->Alpha), text1); ImGui::SameLine();
        ImGui::SetCursorPosX(ImGui::GetContentRegionMax().x - text_size.x);
        ImGui::TextColored(col_sec, text2);
        };

    struct s_product_status {
        const char* name;
        ImVec4 color;
    };

    static s_product_status cur_status[3] = {
        { "Avalible", ImVec4(127 / 255.f, 238 / 255.f, 131 / 255.f, 1.f) },
        { "On Update", ImVec4(238 / 255.f, 234 / 255.f, 127 / 255.f, 1.f) },
        { "Frozen", ImVec4(127 / 255.f, 192 / 255.f, 238 / 255.f, 1.f) }
    };

    ImGui::PushFont(ui_font[e_fonts::INTER_14]);
    ImGui::TextColored(ImVec4(0.9f, 0.9f, 0.9f, 1.f * s->Alpha), "Product Information");
    ImGui::PopFont();

    ImGui::SetCursorPos(pos + ImVec2(181, 94));
    ImGui::BeginChild("##main-block", ImVec2(272, 141)); {
        ImGuiWindow* window = ImGui::GetCurrentWindow();
        window->DrawList->AddRectFilled(window->Pos, window->Pos + window->Size, ImColor(1.f, 1.f, 1.f, (5 / 255.f) * s->Alpha), 3.f);

        ImGui::SetCursorPos(pos + ImVec2(20, 20)); // spacing
        ImGui::BeginChild("##inner-box", ImVec2(232, 102)); {
            s->ItemSpacing = ImVec2(0, 15);
            draw_text_row("Game", name);
            draw_text_row("Version", ver);
            draw_text_row("Status", cur_status[status_id].name, cur_status[status_id].color);
            draw_text_row("Till Expiry", till_expiry);
        }; ImGui::EndChild();

    } ImGui::EndChild();

    ImGui::SetCursorPos({ 181, 245 });
    if (peroxide_ui::button("Inject", { 272, 27 }, peroxide_ui::trans_black)) g_ui_events.inject_btn();
}

void user_block() {
    ImGuiStyle* s = &ImGui::GetStyle();

    ImGui::BeginChild("##user_block", { 134, 26 }); {
        ImGuiWindow* window = ImGui::GetCurrentWindow();
        ImVec2 pos = window->Pos;
        ImVec2 size = window->Size;

        window->DrawList->AddCircleFilled(ImVec2(pos.x + 13, pos.y + 13), 13, ImColor(1.f, 1.f, 1.f, 40 / 255.f), 64);
        window->DrawList->AddText(ui_font[e_fonts::INTER_14], 14.f, ImVec2(pos.x + 36, pos.y + 5.5f), ImColor(1.f, 1.f, 1.f, 1.f), "username");

    }; ImGui::EndChild();
}

void personal_area_page() {
    ImGuiWindow* window = ImGui::GetCurrentWindow();
    ImVec2 pos = window->Pos;
    ImVec2 size = window->Size;
    ImGuiStyle* s = &ImGui::GetStyle();

    window->DrawList->AddLine(pos + ImVec2(161, 51), pos + ImVec2(161, 334), ImColor(1.f, 1.f, 1.f, 10 / 255.f));
    window->DrawList->AddLine(pos + ImVec2(0, 287), pos + ImVec2(160, 287), ImColor(1.f, 1.f, 1.f, 10 / 255.f)); 

    enum e_tabs {
        altv, ragemp, deadlock
    };
    static e_tabs cur_tab = altv;
    static float tab_content_alpha = 0.f;

    auto switch_tab = [&](e_tabs num) {
        if (cur_tab != num) cur_tab = num, tab_content_alpha = 0.f;
        };

    main_render.change_content_alpha(1.f, 3.f);

    ImGui::SetCursorPos(pos + ImVec2(10, 61));
    ImGui::BeginChild(765, { 140, 120 }); {
        s->ItemSpacing = { 0, 5 };
        if (peroxide_ui::tab("Alt:V", cur_tab == altv)) switch_tab(altv);
        if (peroxide_ui::tab("Rage:MP", cur_tab == ragemp)) switch_tab(ragemp);
        if (peroxide_ui::tab("Deadlock", cur_tab == deadlock)) switch_tab(deadlock);
    }; ImGui::EndChild();

    tab_content_alpha = ImLerp(tab_content_alpha, 1.f, ImGui::GetIO().DeltaTime * 3.f);

    ImGui::SetCursorPos({ 10, 298 });
    user_block();

    ImGui::PushStyleVar(ImGuiStyleVar_Alpha, tab_content_alpha);
    ImGui::SetCursorPos({ 181, 71 });
    switch (cur_tab) {
    case altv:
        draw_product("alt:V Multiplayer", "release", 0, "29 days"); break;
    case ragemp:
        draw_product("Rage Multiplayer", "pre-alpha", 1, "15 days"); break;
    case deadlock:
        draw_product("Deadlock", "dev-build", 2, "Lifetime"); break;
    }
    ImGui::PopStyleVar();
}

void inj_status() {
    ImGuiWindow* window = ImGui::GetCurrentWindow();
    ImVec2 pos = window->Pos;
    ImVec2 size = window->Size;
    ImGuiStyle* s = &ImGui::GetStyle();
    window->DrawList->AddText(ui_font[e_fonts::INTER_20], 23.f, pos + ImVec2(173, 148), ImColor(1.f,1.f,1.f,s->Alpha), "Successfully!");

    window->DrawList->AddText(ui_font[e_fonts::INTER_18], 20.f, pos + ImVec2(73, 180), ImColor(1.f, 1.f, 1.f, 125/255.f * s->Alpha), "Now you can back into game and have fun!");
    window->DrawList->AddText(ui_font[e_fonts::INTER_18], 20.f, pos + ImVec2(101, 202), ImColor(1.f, 1.f, 1.f, 125 / 255.f * s->Alpha), "Loader will be closed automatically.");

    main_render.change_content_alpha(1.f, 2.f);

    if (main_render.content_alpha >= 0.9f) {
        static float niggersonline = 0.f; 
        niggersonline = ImLerp(niggersonline, 1.f, ImGui::GetIO().DeltaTime * 1.f);
        if (niggersonline > 0.9f) exit(0);
    }
}