# Truss Load Calculator

A browser-based planning tool for estimating vertical load distribution across multiple truss hanging points.

Define the truss length and linear mass, add point loads and hanging points, and inspect the calculated reactions, center of mass, and maximum bending moment. The complete setup is stored in the URL, making configurations easy to bookmark and share.

> **Development disclosure:** This project was created with OpenAI Codex. Its source code, calculations, and documentation should be independently reviewed before being relied upon.

## Features

- Uniform truss self-weight in `kg/m`
- Any number of named point loads with mass and position
- Multiple hanging points, including truss overhangs
- Hanger reactions reported in `kN` and kilogram-equivalent
- Tension-only hanger model with slack-hanger detection
- Combined center of mass
- Maximum absolute bending moment and its position
- Responsive SVG load and bending-moment diagrams
- Shareable, URL-backed input state
- A4 landscape PDF calculation reports
- Optional report title and notes
- Fully client-side operation with no backend or uploaded calculation data

## Getting started

Requirements:

- Node.js 20.19+ or 22.12+
- npm

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

The development server runs at:

```text
http://localhost:3300/truss/
```

## Available commands

```bash
npm run dev        # Start the Vite development server on port 3300
npm run build      # Type-check and create a production build
npm test           # Run the test suite once
npm run test:watch # Run tests in watch mode
```

The production build is written to `dist/`.

## Deployment

The application is configured for the `/truss/` subpath through Vite's `base` setting. Serve the contents of `dist/` so that `dist/index.html` is available at `/truss/` and its assets are available at `/truss/assets/`.

Example Nginx configuration:

```nginx
location /truss/ {
    alias /path/to/trussCalc/dist/;
    try_files $uri $uri/ /truss/index.html;
}
```

If the deployment path changes, update `base` in [`vite.config.ts`](vite.config.ts).

## Calculation model

The calculator represents the truss as a straight, horizontal, uniform Euler–Bernoulli beam:

- Truss mass is applied as a uniform distributed load.
- Added masses are applied as vertical point loads.
- Hanging points constrain vertical movement while allowing rotation.
- Constant flexural rigidity is normalized to `EI = 1`. Its absolute value does not affect reactions when stiffness is uniform and all active supports have equal elevation.
- Hangers provide upward tension only. A hanging point with a negative calculated reaction is treated as slack and the system is solved again without that support.
- A configuration is reported as unstable if fewer than two distinct active hanging points remain.

Mass values are converted to force using standard gravity:

```text
g = 9.80665 m/s²
```

The reported “most stress” location is the position of maximum absolute bending moment. It is a stress proxy, not an actual member-stress calculation. Calculating member stress would additionally require the truss geometry, material properties, cross-sections, connections, and load combinations.

## URL state

Every valid input is written to query parameters with `history.replaceState`, so editing does not create a browser-history entry for each change.

The version-1 URL schema uses:

| Parameter | Description |
| --- | --- |
| `v` | State schema version |
| `length` | Truss length in metres |
| `massPerMeter` | Truss linear mass in kg/m |
| `loads` | JSON array of named point loads |
| `hangers` | JSON array of hanger positions |
| `reportTitle` | Optional PDF report title |
| `reportNotes` | Optional PDF report notes |

Malformed or unsupported URL data is replaced with safe defaults and produces a warning in the interface.

## PDF reports

The **Export PDF** action creates an A4 landscape report containing:

- Project title, notes, timestamp, and source-configuration link
- Input and hanging-point reaction tables
- Summary values and equilibrium residual
- Calculation formulas and substituted results
- Vector load and bending-moment diagrams
- Solver assumptions and safety limitations

The PDF opens in a new browser tab when permitted. If the browser blocks the tab, it is downloaded instead. Report generation happens locally in the browser using `jsPDF` and `jsPDF-AutoTable`.

## Testing

The Vitest suite covers:

- Analytical simply supported and continuous-beam cases
- Uniform and point loads
- Slack and unstable hanger layouts
- Center-of-mass and zero-load behavior
- URL serialization and backward compatibility
- PDF report data, generation, and pagination

Run all tests and the production build before deployment:

```bash
npm test
npm run build
```

## Important safety notice

This application provides planning estimates only. It does not verify truss members, connections, hoists, dynamic effects, lateral forces, torsion, load factors, or compliance with structural and entertainment-rigging standards.

Have every real rigging or structural design reviewed by a qualified professional and verified against manufacturer documentation and applicable regulations.
