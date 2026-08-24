#pragma once
#include "imgui_impl_win32.h"
#include "rend_inits.h"

extern d3d11_render_inits _d3d;

LRESULT WINAPI WndProc(HWND hWnd, UINT msg, WPARAM wParam, LPARAM lParam);
POINTS m_Pos;
LRESULT WINAPI WndProc(HWND hWnd, UINT msg, WPARAM wParam, LPARAM lParam)
{
    if (ImGui_ImplWin32_WndProcHandler(hWnd, msg, wParam, lParam))
        return true;

    switch (msg)
    {
    case WM_LBUTTONDOWN:
    {
        m_Pos = MAKEPOINTS(lParam);
        return 0;
    }
    case WM_MOUSEMOVE:
    {
        if (wParam == MK_LBUTTON)
        {
            POINTS p = MAKEPOINTS(lParam);

            RECT rect;
            GetWindowRect(hWnd, &rect);

            rect.left += p.x - m_Pos.x;
            rect.top += p.y - m_Pos.y;
            if (m_Pos.x >= 0 && m_Pos.x <= 600 && m_Pos.y >= 0 && m_Pos.y <= 50) {
                SetWindowPos(hWnd, NULL, rect.left, rect.top, 0, 0, SWP_SHOWWINDOW | SWP_NOSIZE | SWP_NOZORDER);
            }
        }
        return 0;
    }

    case WM_SIZE:
        if (_d3d.get_device() != NULL && wParam != SIZE_MINIMIZED)
        {
            _d3d.cleanup_rendertagret();
            _d3d.get_swapchain()->ResizeBuffers(0, (UINT)LOWORD(lParam), (UINT)HIWORD(lParam), DXGI_FORMAT_UNKNOWN, 0);
            _d3d.create_rendertarget();
        }
        return 0;
    case WM_SYSCOMMAND:
        if ((wParam & 0xfff0) == SC_KEYMENU) // Disable ALT application menu
            return 0;
        break;
    case WM_DESTROY:
        ::PostQuitMessage(0);
        return 0;
    }
    return ::DefWindowProc(hWnd, msg, wParam, lParam);
}