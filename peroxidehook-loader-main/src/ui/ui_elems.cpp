#include "ui_elems.h"
#include "fonts.h"
#include <unordered_map>

bool peroxide_ui::button(const char* label, const ImVec2& size_arg, e_btn_style btn_style)
{
    ImGuiWindow* window = ImGui::GetCurrentWindow();
    ImGuiStyle* s = &ImGui::GetStyle();
    if (window->SkipItems)
        return false; 

    ImGuiContext& g = *GImGui;
    const ImGuiStyle& style = g.Style;
    const ImGuiID id = window->GetID(label);
    const ImVec2 label_size = ui_font[e_fonts::INTER_14]->CalcTextSizeA(14.0f, FLT_MAX, 0.0f, label);

    ImVec2 pos = window->DC.CursorPos;
    ImVec2 size = ImGui::CalcItemSize(size_arg, label_size.x + style.FramePadding.x * 2.0f, label_size.y + style.FramePadding.y * 2.0f);

    const ImRect bb(pos, pos + size);
    ImGui::ItemSize(size, style.FramePadding.y);
    if (!ImGui::ItemAdd(bb, id))
        return false;

    bool hovered, held;
    bool pressed = ImGui::ButtonBehavior(bb, id, &hovered, &held, 0);

    static std::map <ImGuiID, button_anim> anim;
    auto it_anim = anim.find(id);
    if (it_anim == anim.end())
    {
        anim.insert({ id, {0.f} });
        it_anim = anim.find(id);
    }

    // Render
    ImGui::RenderNavHighlight(bb, id);

    ImVec2 text_pos = ImVec2((bb.Min.x + bb.Max.x) / 2 - (label_size.x / 2), (bb.Min.y + bb.Max.y) / 2 - (label_size.y / 2));

    if (btn_style == radial_white) {
        it_anim->second.frame = ImLerp(it_anim->second.frame, hovered ? 0.11f : pressed ? 0.3f : 0.1f, ImGui::GetIO().DeltaTime * 12.f);
        it_anim->second.grd = ImLerp(it_anim->second.grd, hovered ? 0.9f : pressed ? 1.f : 0.5f, ImGui::GetIO().DeltaTime * 14.f);
        it_anim->second.text_glow = ImLerp(it_anim->second.text_glow, hovered ? 0.4f : pressed ? 0.5f : 0.f, ImGui::GetIO().DeltaTime * 5.f);

        window->DrawList->AddRectFilled(bb.Min, bb.Max, ImColor(1.f, 1.f, 1.f, it_anim->second.frame * s->Alpha), 3);
        ImGui::PushClipRect(bb.Min, bb.Max, true);
        window->DrawList->_FringeScale = 60.0f;
        window->DrawList->AddCircleFilled(ImVec2((bb.Min.x + bb.Max.x) / 2, (bb.Min.y + bb.Max.y) / 2), 70, ImColor(1.f, 1.f, 1.f, it_anim->second.grd * s->Alpha), 64);
        window->DrawList->_FringeScale = 1.0f;
        ImGui::PopClipRect();

        window->DrawList->_FringeScale = 20.0f; // shdw in this case
        window->DrawList->AddText(ui_font[e_fonts::INTER_14], 14.f, text_pos + ImVec2(0, 1), ImColor(0.f, 0.f, 0.f, it_anim->second.text_glow * s->Alpha), label);
        window->DrawList->_FringeScale = 1.0f;

        window->DrawList->AddText(ui_font[e_fonts::INTER_14], 14.f, text_pos, ImColor(0.f, 0.f, 0.f, s->Alpha), label);
    }
    if (btn_style == trans_black) {
        it_anim->second.frame = ImLerp(it_anim->second.frame, pressed ? 6 / 255.f : 5 / 255.f, ImGui::GetIO().DeltaTime * 12.f);
        it_anim->second.text_glow = ImLerp(it_anim->second.text_glow, hovered ? 0.4f : pressed ? 0.5f : 0.f, ImGui::GetIO().DeltaTime * 12.f);

        window->DrawList->AddRectFilled(bb.Min, bb.Max, ImColor(1.f, 1.f, 1.f, it_anim->second.frame * s->Alpha), 3);
        window->DrawList->_FringeScale = 5.0f; // glow
        window->DrawList->AddText(ui_font[e_fonts::INTER_14], 14.f, text_pos + ImVec2(0, 1), ImColor(1.f, 1.f, 1.f, it_anim->second.text_glow * s->Alpha), label);
        window->DrawList->AddText(ui_font[e_fonts::INTER_14], 14.f, text_pos + ImVec2(1, 0), ImColor(1.f, 1.f, 1.f, it_anim->second.text_glow * s->Alpha), label);
        window->DrawList->AddText(ui_font[e_fonts::INTER_14], 14.f, text_pos - ImVec2(0, 1), ImColor(1.f, 1.f, 1.f, it_anim->second.text_glow * s->Alpha), label);
        window->DrawList->AddText(ui_font[e_fonts::INTER_14], 14.f, text_pos - ImVec2(1, 0), ImColor(1.f, 1.f, 1.f, it_anim->second.text_glow * s->Alpha), label);
        window->DrawList->_FringeScale = 1.0f;
        window->DrawList->AddText(ui_font[e_fonts::INTER_14], 14.f, text_pos, ImColor(1.f, 1.f, 1.f, s->Alpha), label);
    }

    if (hovered) {
        ImGui::SetMouseCursor(ImGuiMouseCursor_Hand);
    }

    return pressed;
}

bool peroxide_ui::dotbutton(const char* label, ImColor col) {
    ImGuiWindow* window = ImGui::GetCurrentWindow();
    ImGuiStyle* s = &ImGui::GetStyle();
    if (window->SkipItems)
        return false;

    ImGuiContext& g = *GImGui;
    const ImGuiStyle& style = g.Style;
    const ImGuiID id = window->GetID(label);

    ImVec2 pos = window->DC.CursorPos;
    ImVec2 size = ImGui::CalcItemSize(ImVec2(12, 12), 12, 12);

    const ImRect bb(pos, pos + size);
    ImGui::ItemSize(size, style.FramePadding.y);
    if (!ImGui::ItemAdd(bb, id))
        return false;

    static std::map <ImGuiID, dotbutton_anim> anim;
    auto it_anim = anim.find(id);
    if (it_anim == anim.end())
    {
        anim.insert({ id, {0.f} });
        it_anim = anim.find(id);
    }

    bool hovered, held;
    bool pressed = ImGui::ButtonBehavior(bb, id, &hovered, &held, 0);

    ImGui::RenderNavHighlight(bb, id);
    it_anim->second.outline_op = ImLerp(it_anim->second.outline_op, hovered ? 0.2f : pressed ? 0.3f : 0.1f, ImGui::GetIO().DeltaTime * 15.f);
    window->DrawList->AddCircle(ImVec2((bb.Min.x + bb.Max.x) / 2, (bb.Min.y + bb.Max.y) / 2), 5, ImColor(1.f, 1.f, 1.f, it_anim->second.outline_op), 26, 1);
    window->DrawList->AddCircleFilled(ImVec2((bb.Min.x + bb.Max.x) / 2, (bb.Min.y + bb.Max.y) / 2), 4, col, 26);
    
    if (hovered) {
        ImGui::SetMouseCursor(ImGuiMouseCursor_Hand);
    }

    return pressed;
}

bool peroxide_ui::input(const char* name, const char* hint, char buf[], size_t buf_size, float width, ImGuiInputTextFlags womp) {
    ImGui::SetNextItemWidth(width);
    ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, ImVec2(10,7));
    ImGui::PushStyleVar(ImGuiStyleVar_FrameRounding, 3);
    ImGui::PushStyleColor(ImGuiCol_FrameBg, ImVec4(0.f, 0.f, 0.f, 20/255.f));
    ImGui::PushStyleColor(ImGuiCol_TextDisabled, ImVec4(1.f, 1.f, 1.f, 45 / 255.f));

    ImVec2 pos = ImGui::GetCursorPos();

    bool result = ImGui::InputTextEx(name, hint, buf, (int)buf_size, ImVec2(0, 0), womp, 0, 0);

    ImGuiWindow* window = ImGui::GetCurrentWindow();
    ImVec2 box_size = ImGui::GetItemRectSize();
    window->DrawList->AddRect(pos, pos + box_size, ImColor(1.f, 1.f, 1.f, (10 / 255.f) * ImGui::GetStyle().Alpha), 3);

    ImGui::PopStyleVar(2);
    ImGui::PopStyleColor(2);

    return result;
}

bool peroxide_ui::checkbox(const char* icon, bool* v) {
    ImGuiWindow* window = ImGui::GetCurrentWindow();
    ImGuiStyle* s = &ImGui::GetStyle();
    if (window->SkipItems)
        return false;

    ImGuiContext& g = *GImGui;
    const ImGuiStyle& style = g.Style;
    const ImGuiID id = window->GetID(icon);
    const ImVec2 label_size = ui_font[e_fonts::INTER_16]->CalcTextSizeA(16.0f, FLT_MAX, 0.0f, icon);

    const float w = 255;
    const float square_sz = 17;
    const ImVec2 pos = window->DC.CursorPos + ImVec2(5,0);
    const ImRect frame_bb(pos + ImVec2(w - 24, 0), pos + ImVec2(w, 13));
    const ImRect total_bb(pos, pos + ImVec2(square_sz + style.ItemInnerSpacing.x + label_size.x + 105, label_size.y)); //+ style.FramePadding.y * 2.0f
    ImGui::ItemSize(total_bb, style.FramePadding.y);
    if (!ImGui::ItemAdd(total_bb, id))
    {
        IMGUI_TEST_ENGINE_ITEM_INFO(id, label, g.LastItemData.StatusFlags | ImGuiItemStatusFlags_Checkable | (*v ? ImGuiItemStatusFlags_Checked : 0));
        return false;
    }

    bool hovered, held;
    bool pressed = ImGui::ButtonBehavior(frame_bb, id, &hovered, &held);
    if (pressed)
    {
        *v = !(*v);
        ImGui::MarkItemEdited(id);
    }

    static std::map <ImGuiID, checkbox_animation> anim;
    auto it_anim = anim.find(id);
    if (it_anim == anim.end())
    {
        anim.insert({ id, { 0.0f } });
        it_anim = anim.find(id);
    }

    it_anim->second.animation = ImLerp(it_anim->second.animation, *v ? 1.0f : 0.0f, 0.10f * (1.0f - ImGui::GetIO().DeltaTime));
    it_anim->second.text_anim = ImLerp(it_anim->second.text_anim, *v ? 1.0f : 125/255.f, 0.12f * (1.0f - ImGui::GetIO().DeltaTime));

    ImGui::RenderNavHighlight(total_bb, id);

    //ImGui::RenderFrame(frame_bb.Min, frame_bb.Max, ImColor(0/255.f, 0/255.f, 0/255.f, 1.f * s->Alpha), false, 9.0f);
    ImGui::RenderFrame(frame_bb.Min, frame_bb.Max, ImColor(1.0f, 1.0f, 1.0f, 76/255.f * s->Alpha), false, 11.0f);
    //window->DrawList->AddCircleFilled(ImVec2((frame_bb.Min.x + 7) + 10 * it_anim->second.animation, frame_bb.Min.y + 6.5f), 4.5f, col_mgmt::get(ImVec4(169, 169, 169, 255 * s->Alpha)), 36);

    //window->DrawList->AddRectFilled(frame_bb.Min, frame_bb.Max, ImColor(255 / 255.f, 255 / 255.f, 255 / 255.f, 30 / 255.f * s->Alpha), 11.0f);

    if (label_size.x > 0.0f)
        window->DrawList->AddText(ui_font[e_fonts::INTER_16], 16, pos, ImColor(255 / 255.f, 255 / 255.f, 255 / 255.f, it_anim->second.text_anim * s->Alpha), icon);

    IMGUI_TEST_ENGINE_ITEM_INFO(id, label, g.LastItemData.StatusFlags | ImGuiItemStatusFlags_Checkable | (*v ? ImGuiItemStatusFlags_Checked : 0));
    return pressed;
}

struct s_tab_element {
    s_tab_animation anim;
    element_state_t state;
};

bool peroxide_ui::tab(const char* label, bool boolean)
{
    static std::unordered_map<ImGuiID, s_tab_element> _element;

    ImGuiWindow* window = ImGui::GetCurrentWindow();
    const ImGuiID id = window->GetID(label);
    ImGuiStyle* s = &ImGui::GetStyle();

    const ImVec2 label_size = _calc_text_size(ui_font[e_fonts::INTER_14], 14, label);
    ImVec2 pos = window->DC.CursorPos;

    const ImRect rect(pos, ImVec2(pos.x + 140, pos.y + 29));
    ImGui::ItemSize(ImVec4(rect.Min.x, rect.Min.y, rect.Max.x, rect.Max.y + 3), s->FramePadding.y);
    if (!ImGui::ItemAdd(rect, id))
        return false;

    _element.try_emplace(id, s_tab_element());
    auto this_element = _element.find(id);
    s_tab_animation* this_anim = &this_element->second.anim;
    element_state_t* this_state = &this_element->second.state;

    this_state->pressed = ImGui::ButtonBehavior(rect, id, &this_state->hovered, &this_state->held, NULL);

    this_anim->text_pos_x = ImLerp(this_anim->text_pos_x, (boolean ? rect.Min.x + 15 : this_state->hovered ? rect.Min.x + 14 : rect.Min.x + 10), ImGui::GetIO().DeltaTime * 12.f);
    this_anim->rect_op = ImLerp(this_anim->rect_op, (boolean ? 5/255.f : this_state->hovered ? 2/255.f : 0.0f), ImGui::GetIO().DeltaTime * 12.f);
    this_anim->text_op = ImLerp(this_anim->text_op, (this_anim->text_pos_x > 0.9f ? (boolean ? 1.0f : this_state->hovered ? 40 / 255.f : 0.3f) : 0.f), ImGui::GetIO().DeltaTime * 12.f);
    this_anim->line_op = ImLerp(this_anim->line_op, (boolean ? 1.0f : 0.0f), ImGui::GetIO().DeltaTime * 12.f);

    window->DrawList->AddRectFilled(rect.Min, rect.Max,
        ImColor(1.f, 1.f, 1.f, this_anim->rect_op * s->Alpha), 2.0f); // bg rect

    window->DrawList->AddText(ImVec2(this_anim->text_pos_x, (rect.Min.y + rect.Max.y) / 2 - label_size.y / 2),
        ImColor(1.0f, 1.0f, 1.0f, this_anim->text_op * s->Alpha), label); // tab label

    window->DrawList->AddRectFilled(ImVec2(rect.Max.x - 2, rect.Min.y), ImVec2(rect.Max.x, rect.Max.y),
        ImColor(1.f, 1.f, 1.f, this_anim->line_op * s->Alpha), 2.0f, 160); // ind line

    if (this_state->hovered && !boolean)
        ImGui::SetMouseCursor(ImGuiMouseCursor_Hand);

    return this_state->pressed;
}