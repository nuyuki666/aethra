#include "fonts.h"
#include "fonts_data.h"
//#include "imgui_freetype.h"

ImFont* ui_font[6]{};

void ui_fonts::initialize() {
    ImGuiIO& io = ImGui::GetIO(); (void)io;

    ImFontConfig font_config;
    font_config.PixelSnapH = false;
    font_config.OversampleH = 5;
    font_config.OversampleV = 5;
    font_config.RasterizerMultiply = 1.2f;

    static const ImWchar ranges[] = { 0x0020, 0x00FF, 0x0400, 0x052F, 0x2DE0, 0x2DFF, 0xA640, 0xA69F, 0xE000, 0xE226, 0, };
    font_config.GlyphRanges = ranges;

    struct FontData {
        void* raw_data;
        size_t data_size;
        float size;
        e_fonts font_id;
    };

    FontData fonts[] = {
        { Inter18ptMedium_Raw, sizeof(Inter18ptMedium_Raw), 14.0f, e_fonts::INTER_14 },
        { Inter18ptMedium_Raw, sizeof(Inter18ptMedium_Raw), 16.0f, e_fonts::INTER_16 },
        { Inter18ptMedium_Raw, sizeof(Inter18ptMedium_Raw), 18.0f, e_fonts::INTER_18 },
        { Inter18ptMedium_Raw, sizeof(Inter18ptMedium_Raw), 23.0f, e_fonts::INTER_20 },
        
        { Icons_Raw, sizeof(Icons_Raw), 16.0f, e_fonts::ICONS_16 },
        { Icons_Raw, sizeof(Icons_Raw), 18.0f, e_fonts::ICONS_18 },
        { Icons_Raw, sizeof(Icons_Raw), 28.0f, e_fonts::ICONS_28 }

    };

    for (const auto& font : fonts) {
        ui_font[font.font_id] = io.Fonts->AddFontFromMemoryTTF(font.raw_data, font.data_size, font.size, &font_config, ranges);
    }
}