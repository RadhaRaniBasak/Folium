// Akar Icons (MIT © Arturo Wibawa, https://akaricons.com) — only the ones Folium uses.
// The npm package is a single CommonJS file, so importing it ships all 400+ icons;
// add new ones here by copying their SVG body from akaricons.com.
import type { SVGAttributes } from 'react';

export interface IconProps extends SVGAttributes<SVGElement> {
  size?: number | string;
  color?: string;
}

function icon(
  body: string,
  base: { fill: string; stroke: string } = { fill: 'none', stroke: 'currentColor' },
) {
  return function Icon({ size = 24, color, strokeWidth = 2, ...props }: IconProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={base.fill === 'none' ? 'none' : (color ?? base.fill)}
        stroke={base.stroke === 'none' ? 'none' : (color ?? base.stroke)}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
        dangerouslySetInnerHTML={{ __html: body }}
      />
    );
  };
}

export const ArrowCounterClockwise = icon(
  '<path d="M4.266 16.06a8.923 8.923 0 0 0 3.915 3.978 8.706 8.706 0 0 0 5.471.832 8.796 8.796 0 0 0 4.887-2.64 9.067 9.067 0 0 0 2.388-5.079 9.137 9.137 0 0 0-1.044-5.53 8.904 8.904 0 0 0-4.068-3.815 8.7 8.7 0 0 0-5.5-.608c-1.85.401-3.367 1.313-4.62 2.755-.152.16-.736.806-1.22 1.781"></path><path d="M8.931 7.813l-5.04.907L3 3.59"></path>',
);
export const ArrowShuffle = icon(
  '<path d="M2 19h3.908a2 2 0 0 0 1.682-.919L11.5 12l3.91-6.082A2 2 0 0 1 17.091 5H22m0 14h-4.908a2 2 0 0 1-1.682-.919L13.428 15M2 5h3.908a2 2 0 0 1 1.682.918L9.571 9"></path><path d="M19 2l3 3-3 3"></path><path d="M19 16l3 3-3 3"></path>',
);
export const Check = icon('<path d="M4 12l6 6L20 6"></path>');
export const ChevronDown = icon('<path d="M4 9l8 8 8-8"></path>');
export const ChevronRight = icon('<path d="M8 4l8 8-8 8"></path>');
export const Copy = icon(
  '<path d="M8 4v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.242a2 2 0 0 0-.602-1.43L16.083 2.57A2 2 0 0 0 14.685 2H10a2 2 0 0 0-2 2z"></path><path d="M16 18v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2"></path>',
);
export const Cross = icon('<path d="M20 20L4 4m16 0L4 20"></path>');
export const Download = icon(
  '<path d="M12 15V3m0 12l-4-4m4 4l4-4"></path><path d="M2 17l.621 2.485A2 2 0 0 0 4.561 21H19.439a2 2 0 0 0 1.94-1.515L22 17"></path>',
);
export const EyeOpen = icon(
  '<path d="M21.257 10.962c.474.62.474 1.457 0 2.076C19.764 14.987 16.182 19 12 19c-4.182 0-7.764-4.013-9.257-5.962a1.692 1.692 0 0 1 0-2.076C4.236 9.013 7.818 5 12 5c4.182 0 7.764 4.013 9.257 5.962z"></path><circle cx="12" cy="12" r="3"></circle>',
);
export const EyeSlashed = icon(
  '<path d="M6.873 17.129c-1.845-1.31-3.305-3.014-4.13-4.09a1.693 1.693 0 0 1 0-2.077C4.236 9.013 7.818 5 12 5c1.876 0 3.63.807 5.13 1.874"></path><path d="M14.13 9.887a3 3 0 1 0-4.243 4.242"></path><path d="M4 20L20 4"></path><path d="M10 18.704A7.124 7.124 0 0 0 12 19c4.182 0 7.764-4.013 9.257-5.962a1.694 1.694 0 0 0-.001-2.078A22.939 22.939 0 0 0 19.57 9"></path>',
);
export const FaceHappy = icon(
  '<circle cx="12" cy="12" r="10"></circle><path d="M8 9.05v-.1"></path><path d="M16 9.05v-.1"></path><path d="M16 14c-.5 1.5-1.79 3-4 3s-3.5-1.5-4-3"></path>',
);
export const File = icon(
  '<path d="M4 4v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.342a2 2 0 0 0-.602-1.43l-4.44-4.342A2 2 0 0 0 13.56 2H6a2 2 0 0 0-2 2z"></path><path d="M9 13h6"></path><path d="M9 17h3"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path>',
);
export const Image = icon(
  '<path d="M2 6a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V6z"></path><circle cx="8.5" cy="8.5" r="2.5"></circle><path d="M14.526 12.621L6 22h12.133A3.867 3.867 0 0 0 22 18.133V18c0-.466-.175-.645-.49-.99l-4.03-4.395a2 2 0 0 0-2.954.006z"></path>',
);
export const LinkChain = icon(
  '<path d="M13.544 10.456a4.368 4.368 0 0 0-6.176 0l-3.089 3.088a4.367 4.367 0 1 0 6.177 6.177L12 18.177"></path><path d="M10.456 13.544a4.368 4.368 0 0 0 6.176 0l3.089-3.088a4.367 4.367 0 1 0-6.177-6.177L12 5.823"></path>',
);
export const Moon = icon(
  '<path d="M20.958 15.325c.204-.486-.379-.9-.868-.684a7.684 7.684 0 0 1-3.101.648c-4.185 0-7.577-3.324-7.577-7.425a7.28 7.28 0 0 1 1.134-3.91c.284-.448-.057-1.068-.577-.936C5.96 4.041 3 7.613 3 11.862 3 16.909 7.175 21 12.326 21c3.9 0 7.24-2.345 8.632-5.675z"></path><path d="M15.611 3.103c-.53-.354-1.162.278-.809.808l.63.945a2.332 2.332 0 0 1 0 2.588l-.63.945c-.353.53.28 1.162.81.808l.944-.63a2.332 2.332 0 0 1 2.588 0l.945.63c.53.354 1.162-.278.808-.808l-.63-.945a2.332 2.332 0 0 1 0-2.588l.63-.945c.354-.53-.278-1.162-.809-.808l-.944.63a2.332 2.332 0 0 1-2.588 0l-.945-.63z"></path>',
);
export const MoreHorizontalFill = icon(
  '<path fill-rule="evenodd" clip-rule="evenodd" d="M2 12a2 2 0 1 1 4 0 2 2 0 0 1-4 0z"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M10 12a2 2 0 1 1 4 0 2 2 0 0 1-4 0z"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M18 12a2 2 0 1 1 4 0 2 2 0 0 1-4 0z"></path>',
  { fill: 'currentColor', stroke: 'none' },
);
export const PanelLeft = icon(
  '<rect x="2" y="3" width="20" height="18" rx="2"></rect><path d="M9 3v18"></path>',
);
export const Pencil = icon(
  '<path d="M4.333 16.048L16.57 3.81a2.56 2.56 0 0 1 3.62 3.619L7.951 19.667a2 2 0 0 1-1.022.547L3 21l.786-3.93a2 2 0 0 1 .547-1.022z"></path><path d="M14.5 6.5l3 3"></path>',
);
export const PersonAdd = icon(
  '<circle cx="12" cy="7" r="5"></circle><path d="M17 22H5.266a2 2 0 0 1-1.985-2.248l.39-3.124A3 3 0 0 1 6.649 14H7"></path><path d="M19 14v4"></path><path d="M17 16h4"></path>',
);
export const Plus = icon('<path d="M12 20v-8m0 0V4m0 8h8m-8 0H4"></path>');
export const Search = icon(
  '<path d="M21 21l-4.486-4.494M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0z"></path>',
);
export const SignOut = icon(
  '<path d="M13 12h9m0 0l-3.333-4M22 12l-3.333 4"></path><path d="M14 7V5.174a2 2 0 0 0-2.166-1.993l-8 .666A2 2 0 0 0 2 5.84v12.32a2 2 0 0 0 1.834 1.993l8 .667A2 2 0 0 0 14 18.826V17"></path>',
);
export const SoundOff = icon(
  '<path d="M22 15l-6-6m6 0l-6 6"></path><path d="M2 14.959V9.04C2 8.466 2.448 8 3 8h3.586a.98.98 0 0 0 .707-.305l3-3.388c.63-.656 1.707-.191 1.707.736v13.914c0 .934-1.09 1.395-1.716.726l-2.99-3.369A.98.98 0 0 0 6.578 16H3c-.552 0-1-.466-1-1.041z"></path>',
);
export const SoundOn = icon(
  '<path d="M2 14.959V9.04C2 8.466 2.448 8 3 8h3.586a.98.98 0 0 0 .707-.305l3-3.388c.63-.656 1.707-.191 1.707.736v13.914c0 .934-1.09 1.395-1.716.726l-2.99-3.369A.98.98 0 0 0 6.578 16H3c-.552 0-1-.466-1-1.041z"></path><path d="M16 8.5c1.333 1.778 1.333 5.222 0 7"></path><path d="M19 5c3.988 3.808 4.012 10.217 0 14"></path>',
);
export const Star = icon(
  '<path d="M11.074 2.633c.32-.844 1.531-.844 1.852 0l2.07 5.734c.145.38.514.633.926.633h5.087c.94 0 1.35 1.17.611 1.743L18 14a.968.968 0 0 0-.322 1.092L19 20.695c.322.9-.72 1.673-1.508 1.119l-4.917-3.12a1 1 0 0 0-1.15 0l-4.917 3.12c-.787.554-1.83-.22-1.508-1.119l1.322-5.603A.968.968 0 0 0 6 14l-3.62-3.257C1.64 10.17 2.052 9 2.99 9h5.087a.989.989 0 0 0 .926-.633l2.07-5.734z"></path>',
);
export const Sun = icon(
  '<path d="M12 3V2m0 20v-1m9-9h1M2 12h1m15.5-6.5L20 4M4 20l1.5-1.5M4 4l1.5 1.5m13 13L20 20"></path><circle cx="12" cy="12" r="4"></circle>',
);
export const TrashCan = icon(
  '<path d="M4 6h16l-1.58 14.22A2 2 0 0 1 16.432 22H7.568a2 2 0 0 1-1.988-1.78L4 6z"></path><path d="M7.345 3.147A2 2 0 0 1 9.154 2h5.692a2 2 0 0 1 1.81 1.147L18 6H6l1.345-2.853z"></path><path d="M2 6h20"></path><path d="M10 11v5"></path><path d="M14 11v5"></path>',
);
export const Width = icon('<path d="M22 12H2m20 0l-4 4m4-4l-4-4M2 12l4 4m-4-4l4-4"></path>');
