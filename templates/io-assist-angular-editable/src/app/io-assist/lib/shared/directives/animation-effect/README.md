# Animation Effect Directive

Applies animated visual effects to HTML elements using the Strategy pattern. Supports single animations and chaining.

## Quick Start

```html
<!-- Default hover animation -->
<button animationEffect>Hover me</button>

<!-- Specific animation -->
<div [animationEffect]="AnimationType.MOUNT_360_GLOW">Glowing content</div>

<!-- Chained animations -->
<div [animationEffect]="[AnimationType.MOUNT_360_GLOW, AnimationType.HOVER_MOUSE_FOLLOW]">
    Glow on mount, then hover effect
</div>
```

## Available Animations

| Type | Behavior | Best For |
|------|----------|----------|
| `HOVER_MOUSE_FOLLOW` | Gradient border follows cursor on hover | Buttons, cards, interactive elements |
| `MOUNT_360_GLOW` | 360° rotating glow on mount, fades to static border | Input areas, important containers |

## Animation Chaining

Pass an array to play animations sequentially:

```typescript
protected readonly animationChain = [
    AnimationType.MOUNT_360_GLOW,      // Auto-completes after rotation
    AnimationType.HOVER_MOUSE_FOLLOW   // Remains active for interaction
];
```

**Chain behavior:**
- Auto-completing animations trigger the next in sequence
- Interactive animations remain active as the final state
- Each animation cleans up before the next starts

## Adding New Animations

1. **Add to enum** (`animation-type.enum.ts`)
2. **Create strategy class** extending `BaseAnimationStrategy` in `effects/`
3. **Register in factory** (`animation-effect.factory.ts`)
4. **Add to chained strategy** (`chained-animation.effect.ts`)

Key implementation points:
- Call `this.notifyComplete()` when auto-completing animations finish
- Interactive animations should NOT call `notifyComplete()`
- Implement `cleanup()` to remove DOM elements and clear timers

### Example: Red Border Animation

A simple animation that smoothly transitions the border to 2px solid red on mount.

**Step 1: Add to enum**
```typescript
// animation-type.enum.ts
MOUNT_RED_BORDER = 'mount-red-border',
```

**Step 2: Create the strategy**
```typescript
// effects/mount-red-border-animation.effect.ts
import { ElementRef, Renderer2 } from '@angular/core';
import { BaseAnimationStrategy } from '../core/base-animation.effect';

export class MountRedBorderAnimationStrategy extends BaseAnimationStrategy {
    private originalBorder = '';

    constructor(elementRef: ElementRef, renderer: Renderer2) {
        super(elementRef, renderer);
    }

    public setup(onComplete?: () => void): void {
        this.onCompleteCallback = onComplete;
        const host = this.elementRef.nativeElement;

        // Store original border
        this.originalBorder = window.getComputedStyle(host).border;

        // Apply transition and new border
        this.renderer.setStyle(host, 'transition', 'border 300ms ease-in-out');
        this.renderer.setStyle(host, 'border', '2px solid red');

        // Auto-complete after transition
        setTimeout(() => this.notifyComplete(), 300);
    }

    public cleanup(): void {
        const host = this.elementRef.nativeElement;
        this.renderer.setStyle(host, 'border', this.originalBorder);
        this.renderer.removeStyle(host, 'transition');
    }
}
```

**Step 3: Register in factory** - Add case in `AnimationStrategyFactory.create()`

**Step 4: Add to chained strategy** - Add case in `ChainedAnimationStrategy.createStrategy()`

## CSS Variables

The animations use these design system tokens:

- `--app-accent-color-1`, `--app-accent-color-2` - Gradient colors
- `--app-border-default` - Static border color

## Best Practices

- Apply `border-radius` for proper effect clipping
- Ensure element has a background color
- Keep chains short (2-3 animations max)
- End chains with interactive animations (if needed)

## Architecture

```
animation-effect/
├── animation-effect.directive.ts     # Main directive
├── animation-type.enum.ts            # Animation types
├── core/
│   ├── base-animation.effect.ts      # Abstract base class
│   ├── animation-effect.factory.ts   # Strategy factory
│   └── chained-animation.effect.ts   # Chaining logic
└── effects/
    ├── hover-mouse-follow-animation.effect.ts
    └── mount-360-glow-animation.effect.ts
```