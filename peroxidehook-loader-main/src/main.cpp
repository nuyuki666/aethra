// сосал ебал

#include "main.h"
#include "render/window_render.h"

peroxide_render main_render;

int APIENTRY WinMain(HINSTANCE, HINSTANCE, LPSTR, int)
{
    main_render.initialize_window();
    main_render.initialize_imgui();
    while (main_render.main_frame()) {  }
    main_render.render_shutdown();
 
    return 0;
}
