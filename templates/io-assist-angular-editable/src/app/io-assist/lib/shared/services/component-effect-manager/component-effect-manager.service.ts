import { DestroyRef, effect, EffectRef, Inject, inject, Injectable, InjectionToken, Injector, signal, WritableSignal } from "@angular/core";
import { IOConnectCore } from "@interopio/core";

import { LoggerService } from "../logger/logger.service";

export type NamedEffect = {
    name: string;
    effectRef: EffectRef;
};

const COMPONENT_NAME = new InjectionToken<string>("COMPONENT_NAME");

/**
 * ComponentEffectManagerService
 *
 * A centralized service for managing Angular effects within a component lifecycle.
 * This service provides a structured approach to registering, tracking, and cleaning up
 * effects, ensuring proper memory management and debugging capabilities.
 *
 * Purpose:
 * - Register named effects with descriptive identifiers for easy debugging
 * - Automatically track all active effects per component instance
 * - Ensure proper cleanup on component destruction to prevent memory leaks
 * - Provide console logging for effect registration and destruction during development
 *
 * Usage Pattern:
 * 1. Provide the service in the component's providers array with a factory function
 *    that passes the component name
 * 2. Inject the service in the component
 * 3. Call registerEffects() method in ngOnInit() or constructor
 * 4. Use descriptive naming convention for effect names: 'ComponentName.action.on.trigger'
 *
 * Example:
 * ```typescript
 * @Component({
 *   selector: 'my-component',
 *   providers: [
 *     {
 *       provide: ComponentEffectManagerService,
 *       useFactory: () => new ComponentEffectManagerService('MyComponent'),
 *     },
 *   ],
 * })
 * export class MyComponent implements OnInit {
 *   // Provided in current component
 *   private readonly _effectService = inject(ComponentEffectManagerService);
 *
 *   public ngOnInit(): void {
 *     this.registerEffects();
 *   }
 *
 *   private registerEffects(): void {
 *     this._effectService.registerEffect(
 *       'MyComponent.updateTitle.on.nameChange',
 *       () => this.name() && this.title.set(this.name())
 *     );
 *   }
 * }
 * ```
 *
 * Effect Naming Convention:
 * Format: 'ComponentName.action.on.trigger'
 * - ComponentName: The full component class name (e.g., 'LoginComponent', 'InputAreaComponent')
 * - action: What the effect does (e.g., 'clearError', 'focusInput', 'updateTitle')
 * - trigger: What signal/state change triggers it (e.g., 'passwordChange', 'isEditModeEnabled')
 *
 * Examples:
 * - 'LoginComponent.clearError.on.passwordChange'
 * - 'InputAreaComponent.updateValue.on.selectedPrompt'
 * - 'ThreadHistoryListItemComponent.focusInput.on.isEditModeEnabled'
 *
 * Benefits:
 * - Centralized effect management prevents scattered effect() calls throughout components
 * - Named effects make debugging easier by providing clear identifiers in logs
 * - Automatic cleanup prevents memory leaks
 * - Consistent pattern across all components improves maintainability
 * - Easy to track which effects are active for a given component instance
 */
@Injectable()
export class ComponentEffectManagerService {
    private _injector: Injector = inject(Injector);
    private _namedEffects: WritableSignal<NamedEffect[] | null> = signal<NamedEffect[] | null>(null);
    private readonly _destroyRef: DestroyRef = inject(DestroyRef);
    private readonly _logger: LoggerService = inject(LoggerService);
    protected readonly LOGGER_NAME: string = "ComponentEffectManagerService";

    constructor(
        // eslint-disable-next-line @angular-eslint/prefer-inject
        @Inject(COMPONENT_NAME) public componentNameInjected: string
    ) {
        if (!this.componentNameInjected || this.componentNameInjected.trim() === "") {
            throw new Error("ComponentEffectManagerService requires a valid component name to be provided.");
        }

        this.registerEffect(`${this.componentNameInjected}.namedEffectsListChange`, () => {
            const effects = this._namedEffects();

            if (!effects || effects.length === 0) return;
        });

        this._destroyRef.onDestroy(() => {
            this.destroyAllEffects();
        });
    }

    public registerEffect(name: string, effectFn: () => void): void {
        if (!name || name.trim() === "") {
            this.getLogger().warn("Effect name must be a non-empty string.");

            return;
        }

        const currentEffects: NamedEffect[] = this._namedEffects() ?? [];

        if (currentEffects.find((e) => e.name === name)) {
            this.getLogger().warn(`Effect with name "${name}" is already running.`);

            return;
        }

        // runs the effect
        const effectRef: EffectRef = effect(
            () => {
                effectFn();
            },
            { injector: this._injector }
        );

        const namedEffect: NamedEffect = {
            name,
            effectRef,
        };

        this._namedEffects.set([...currentEffects, namedEffect]);
    }

    public destroyEffect(name: string): void {
        const currentEffects: NamedEffect[] = this._namedEffects() ?? [];

        const effectToDestroy: NamedEffect | undefined = currentEffects.find((e) => e.name === name);

        if (!effectToDestroy) {
            this.getLogger().warn(`No effect found with name "${name}" to destroy.`);

            return;
        }

        effectToDestroy.effectRef.destroy();

        const updatedEffects: NamedEffect[] = currentEffects.filter((e) => e.name !== name);

        this._namedEffects.set(updatedEffects.length > 0 ? updatedEffects : null);
    }

    public destroyAllEffects(): void {
        const effects: NamedEffect[] | null = this._namedEffects();

        if (!effects || effects.length === 0) return;

        effects.forEach((namedEffect) => namedEffect.effectRef.destroy());

        this._namedEffects.set(null);
    }

    private getLogger(): IOConnectCore.Logger.API {
        return this._logger.get(this.LOGGER_NAME);
    }
}
