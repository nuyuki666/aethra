#pragma once

#include "imgui_impl_win32.h"
#include <deque>
#include <string>
#include <map>
#include <D3DX11tex.h>

class d3d11_render_inits {
public:
	bool create_device(HWND hWnd);
	void cleanup_device();
	void create_rendertarget();
	void cleanup_rendertagret();
	// getters
	ID3D11Device* get_device() { return g_pd3dDevice; }
	ID3D11DeviceContext* get_device_context() { return g_pd3dDeviceContext; }
	IDXGISwapChain* get_swapchain() { return g_pSwapChain; }
	ID3D11RenderTargetView* get_rendertarget_v() { return g_mainRenderTargetView; }
private:
	static ID3D11Device* g_pd3dDevice;
	static ID3D11DeviceContext* g_pd3dDeviceContext;
	static IDXGISwapChain* g_pSwapChain;
	static ID3D11RenderTargetView* g_mainRenderTargetView;
};

extern IMGUI_IMPL_API LRESULT ImGui_ImplWin32_WndProcHandler(HWND hWnd, UINT msg, WPARAM wParam, LPARAM lParam);