const MARK_PATHS = [
  "M49.43 98.86h70.34L70.34 148.29H0Z",
  "M169.2 49.43h70.34l-49.43 49.43h-70.34Z",
  "M190.11 98.86h70.35l-49.43 49.43h-70.34Z",
  "M288.97 0h70.35L309.89 49.43h-70.34Z",
  "M309.89 49.43h70.34l-49.43 49.43h-70.34Z",
  "M330.8 98.86h70.34l-49.43 49.43h-70.34Z",
  "M429.66 0h70.34L450.57 49.43h-70.34Z",
  "M148.29 0h70.34L169.2 49.43H98.86Z",
];

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="150" viewBox="0 0 500 150">${MARK_PATHS.map((d) => `<path d="${d}" fill="#fff"/>`).join("")}</svg>`;

export const NAVBAR_PATTERN = `data:image/svg+xml,${encodeURIComponent(SVG)}`;
