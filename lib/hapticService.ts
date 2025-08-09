/**
 * Immersive Haptic Feedback Service for Granny IRL iOS
 * 
 * Provides game-specific haptic patterns that enhance the mobile gaming experience
 * with contextual tactile feedback for skillchecks, proximity detection, and critical actions.
 */

import { Capacitor } from '@capacitor/core';

// Lazy loader to avoid bundling @capacitor/haptics in web builds
async function loadHaptics() {
  try {
    // Only attempt to load on native platforms
    if (!Capacitor.isNativePlatform()) return null;
    // Use indirect dynamic import to avoid bundler resolution at build time
    const importer: (s: string) => Promise<any> = new Function(
      's',
      'return import(s)'
    ) as any;
    const mod = await importer('@capacitor/haptics');
    return mod;
  } catch (err) {
    // Module not available in web build or not installed
    return null;
  }
}

type HapticPreference = 'full' | 'minimal' | 'off';

interface HapticSettings {
  preference: HapticPreference;
  respectLowPowerMode: boolean;
  minInterval: number; // Minimum ms between haptics to prevent spam
}

class HapticService {
  private static instance: HapticService;
  private settings: HapticSettings = {
    preference: 'full',
    respectLowPowerMode: true,
    minInterval: 50
  };
  private lastHapticTime = 0;
  private isLowPowerMode = false;

  private constructor() {
    this.detectLowPowerMode();
  }

  static getInstance(): HapticService {
    if (!HapticService.instance) {
      HapticService.instance = new HapticService();
    }
    return HapticService.instance;
  }

  /**
   * Check if haptic feedback is available and enabled
   */
  private isAvailable(): boolean {
    if (this.settings.preference === 'off') return false;
    if (!Capacitor.isNativePlatform()) return false;
    if (this.settings.respectLowPowerMode && this.isLowPowerMode) return false;
    
    // Rate limiting to prevent haptic spam
    const now = Date.now();
    if (now - this.lastHapticTime < this.settings.minInterval) return false;
    
    return true;
  }

  /**
   * Execute haptic feedback with error handling
   */
  private async executeHaptic(hapticFn: (api: any) => Promise<void>): Promise<void> {
    if (!this.isAvailable()) return;
    
    try {
      const api = await loadHaptics();
      if (!api) return;
      await hapticFn(api);
      this.lastHapticTime = Date.now();
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
    }
  }

  /**
   * Utility method for creating delays in haptic sequences
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // =============================================================================
  // SKILLCHECK HAPTICS
  // =============================================================================

  /**
   * Subtle pulse when player enters skillcheck proximity (50m range)
   * Gentle notification to alert player without being jarring
   */
  async skillcheckProximityEntered(): Promise<void> {
    await this.executeHaptic(async ({ Haptics, ImpactStyle }) => {
      await Haptics.impact({ style: ImpactStyle.Light });
      await this.delay(100);
      await Haptics.impact({ style: ImpactStyle.Light });
    });
  }

  /**
   * Rhythmic heartbeat pattern while within skillcheck range
   * Builds anticipation and tension
   */
  async skillcheckProximityHeartbeat(): Promise<void> {
    await this.executeHaptic(async ({ Haptics, ImpactStyle }) => {
      await Haptics.impact({ style: ImpactStyle.Medium });
      await this.delay(80);
      await Haptics.impact({ style: ImpactStyle.Light });
    });
  }

  /**
   * Satisfying click feedback for successful needle hits during skillcheck
   * Immediate tactile confirmation of successful timing
   */
  async skillcheckHitSuccess(): Promise<void> {
    await this.executeHaptic(async ({ Haptics, ImpactStyle }) => {
      await Haptics.impact({ style: ImpactStyle.Medium });
    });
  }

  /**
   * Sharp feedback for missed skillcheck hits
   * Distinct from success to provide clear failure indication
   */
  async skillcheckHitMiss(): Promise<void> {
    await this.executeHaptic(async ({ Haptics, ImpactStyle }) => {
      await Haptics.impact({ style: ImpactStyle.Light });
    });
  }

  /**
   * Triumphant burst pattern for completed skillcheck
   * Escalating sequence to convey achievement
   */
  async skillcheckCompleted(): Promise<void> {
    await this.executeHaptic(async ({ Haptics, ImpactStyle, NotificationType }) => {
      await Haptics.impact({ style: ImpactStyle.Light });
      await this.delay(80);
      await Haptics.impact({ style: ImpactStyle.Medium });
      await this.delay(80);
      await Haptics.impact({ style: ImpactStyle.Heavy });
      await this.delay(100);
      await Haptics.notification({ type: NotificationType.Success });
    });
  }

  /**
   * Harsh buzz for failed skillcheck
   * Clear negative feedback pattern
   */
  async skillcheckFailed(): Promise<void> {
    await this.executeHaptic(async ({ Haptics, NotificationType }) => {
      await Haptics.notification({ type: NotificationType.Error });
      await this.delay(100);
      await Haptics.vibrate({ duration: 200 });
    });
  }

  // =============================================================================
  // ESCAPE AREA HAPTICS
  // =============================================================================

  /**
   * Urgent rapid pulse when approaching escape area
   * Intensity increases as player gets closer
   */
  async escapeAreaProximity(distance: number): Promise<void> {
    // Intensity based on distance (50m range)
    const pickIntensity = (ImpactStyle: any) => distance < 20 ? ImpactStyle.Heavy : 
                     distance < 35 ? ImpactStyle.Medium : ImpactStyle.Light;
    
    await this.executeHaptic(async ({ Haptics, ImpactStyle }) => {
      const intensity = pickIntensity(ImpactStyle);
      await Haptics.impact({ style: intensity });
      
      // Double pulse for urgency when very close
      if (distance < 20) {
        await this.delay(150);
        await Haptics.impact({ style: ImpactStyle.Medium });
      }
    });
  }

  /**
   * Victory crescendo when player successfully escapes
   * Celebration pattern with building intensity
   */
  async playerEscaped(): Promise<void> {
    await this.executeHaptic(async ({ Haptics, ImpactStyle, NotificationType }) => {
      // Building crescendo
      await Haptics.impact({ style: ImpactStyle.Light });
      await this.delay(120);
      await Haptics.impact({ style: ImpactStyle.Medium });
      await this.delay(120);
      await Haptics.impact({ style: ImpactStyle.Heavy });
      await this.delay(150);
      
      // Victory notification
      await Haptics.notification({ type: NotificationType.Success });
      await this.delay(200);
      
      // Final celebration burst
      for (let i = 0; i < 3; i++) {
        await Haptics.impact({ style: ImpactStyle.Medium });
        await this.delay(100);
      }
    });
  }

  // =============================================================================
  // CRITICAL ACTION HAPTICS
  // =============================================================================

  /**
   * Dramatic impact sequence for "I Was Caught!" button
   * Heavy, impactful pattern to match the gravity of elimination
   */
  async playerCaught(): Promise<void> {
    await this.executeHaptic(async ({ Haptics, ImpactStyle, NotificationType }) => {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      await this.delay(100);
      await Haptics.impact({ style: ImpactStyle.Heavy });
      await this.delay(200);
      await Haptics.impact({ style: ImpactStyle.Medium });
      await this.delay(300);
      await Haptics.notification({ type: NotificationType.Error });
    });
  }

  /**
   * Button press feedback for critical UI actions
   * Clear tactile confirmation for important buttons
   */
  async criticalButtonPress(): Promise<void> {
    await this.executeHaptic(async ({ Haptics, ImpactStyle }) => {
      await Haptics.impact({ style: ImpactStyle.Medium });
    });
  }

  // =============================================================================
  // GAME PHASE TRANSITION HAPTICS
  // =============================================================================

  /**
   * Building tension pattern for headstart → active transition
   * Three escalating pulses to signal the hunt beginning
   */
  async gamePhaseActive(): Promise<void> {
    await this.executeHaptic(async ({ Haptics, ImpactStyle }) => {
      await Haptics.impact({ style: ImpactStyle.Light });
      await this.delay(300);
      await Haptics.impact({ style: ImpactStyle.Medium });
      await this.delay(300);
      await Haptics.impact({ style: ImpactStyle.Heavy });
      await this.delay(200);
      await Haptics.vibrate({ duration: 150 });
    });
  }

  /**
   * Victory fanfare for survivors winning
   */
  async survivorsWin(): Promise<void> {
    await this.executeHaptic(async ({ Haptics, ImpactStyle, NotificationType }) => {
      // Celebration sequence
      for (let i = 0; i < 4; i++) {
        await Haptics.impact({ style: ImpactStyle.Medium });
        await this.delay(120);
      }
      await Haptics.notification({ type: NotificationType.Success });
    });
  }

  /**
   * Defeat pattern for killers winning
   * Heavy, ominous feedback
   */
  async killersWin(): Promise<void> {
    await this.executeHaptic(async ({ Haptics, ImpactStyle }) => {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      await this.delay(200);
      await Haptics.vibrate({ duration: 400 });
    });
  }

  // =============================================================================
  // PROXIMITY & NAVIGATION HAPTICS
  // =============================================================================

  /**
   * Alert pulse when killer detected within 100m
   * Warning pattern to heighten tension
   */
  async killerProximityAlert(): Promise<void> {
    await this.executeHaptic(async ({ Haptics, ImpactStyle }) => {
      await Haptics.impact({ style: ImpactStyle.Medium });
      await this.delay(150);
      await Haptics.impact({ style: ImpactStyle.Light });
      await this.delay(150);
      await Haptics.impact({ style: ImpactStyle.Medium });
    });
  }

  /**
   * Directional haptic feedback based on proximity arrow
   * Different patterns indicate direction to target
   */
  async directionalPulse(bearing: number): Promise<void> {
    // Convert bearing to haptic pattern (simplified directional feedback)
    const pattern = bearing < 90 || bearing > 270 ? 'strong' : 'gentle';
    
    await this.executeHaptic(async ({ Haptics, ImpactStyle }) => {
      if (pattern === 'strong') {
        await Haptics.impact({ style: ImpactStyle.Medium });
        await this.delay(100);
        await Haptics.impact({ style: ImpactStyle.Light });
      } else {
        await Haptics.impact({ style: ImpactStyle.Light });
      }
    });
  }

  // =============================================================================
  // TIMER WARNING HAPTICS
  // =============================================================================

  /**
   * Subtle pulse for timer warnings (60s, 30s, 10s remaining)
   */
  async timerWarning(secondsRemaining: number): Promise<void> {
    const pick = (ImpactStyle: any) => secondsRemaining <= 10 ? ImpactStyle.Heavy :
                     secondsRemaining <= 30 ? ImpactStyle.Medium : ImpactStyle.Light;
    
    await this.executeHaptic(async ({ Haptics, ImpactStyle }) => {
      const intensity = pick(ImpactStyle);
      await Haptics.impact({ style: intensity });
      
      // Final countdown gets double pulse
      if (secondsRemaining <= 10) {
        await this.delay(200);
        await Haptics.impact({ style: ImpactStyle.Medium });
      }
    });
  }

  // =============================================================================
  // SETTINGS & CONFIGURATION
  // =============================================================================

  /**
   * Update haptic preferences
   */
  setPreference(preference: HapticPreference): void {
    this.settings.preference = preference;
    console.log(`Haptic preference set to: ${preference}`);
  }

  /**
   * Get current haptic preference
   */
  getPreference(): HapticPreference {
    return this.settings.preference;
  }

  /**
   * Update low power mode status
   */
  setLowPowerMode(isLowPower: boolean): void {
    this.isLowPowerMode = isLowPower;
  }

  /**
   * Detect low power mode (iOS specific)
   */
  private async detectLowPowerMode(): Promise<void> {
    // This would need to be implemented with a native plugin
    // For now, assume normal power mode
    this.isLowPowerMode = false;
  }

  /**
   * Test haptic pattern for settings/debugging
   */
  async testPattern(): Promise<void> {
    await this.executeHaptic(async () => {
      await Haptics.impact({ style: ImpactStyle.Light });
      await this.delay(200);
      await Haptics.impact({ style: ImpactStyle.Medium });
      await this.delay(200);
      await Haptics.impact({ style: ImpactStyle.Heavy });
      await this.delay(200);
      await Haptics.notification({ type: NotificationType.Success });
    });
  }
}

// Export singleton instance
export const hapticService = HapticService.getInstance();

// Export types for external use
export type { HapticPreference };
export { HapticService };