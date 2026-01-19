/**
 * Connectivity Detection Service Interface
 *
 * This interface will be implemented in the React Native frontend to detect
 * network connectivity changes and trigger synchronization when appropriate.
 *
 * Backend provides configuration and rules that the frontend uses to decide
 * when to sync.
 */

/**
 * Network connection type
 */
export type ConnectionType = "wifi" | "cellular" | "ethernet" | "unknown" | "none";

/**
 * Connection quality estimation
 */
export type ConnectionQuality =
  | "excellent" // Fast WiFi or 5G
  | "good" // 4G or slow WiFi
  | "poor" // 3G or very slow connection
  | "offline"; // No connection

/**
 * Connectivity status
 */
export interface ConnectivityStatus {
  /** Is device connected to internet? */
  isConnected: boolean;

  /** Type of connection */
  connectionType: ConnectionType;

  /** Estimated connection quality */
  quality: ConnectionQuality;

  /** Is connection metered (mobile data)? */
  isMetered: boolean;

  /** Current battery level (0-100) */
  batteryLevel: number;

  /** Is device charging? */
  isCharging: boolean;

  /** Timestamp of last status check */
  timestamp: string;
}

/**
 * Sync eligibility check result
 */
export interface SyncEligibility {
  /** Can sync now? */
  canSync: boolean;

  /** Reasons why sync is blocked (if canSync is false) */
  blockingReasons: string[];

  /** Recommendations for optimal sync */
  recommendations: string[];

  /** Estimated data usage for sync (bytes) */
  estimatedDataUsage: number;
}

/**
 * Connectivity Detection Service Interface
 */
export interface IConnectivityService {
  /**
   * Get current connectivity status
   */
  getStatus(): Promise<ConnectivityStatus>;

  /**
   * Check if device is eligible for sync based on rules
   * @param syncRules - Rules from backend configuration
   */
  checkSyncEligibility(syncRules: SyncRules): Promise<SyncEligibility>;

  /**
   * Monitor connectivity changes
   * @param callback - Called when connectivity changes
   * @returns Unsubscribe function
   */
  onConnectivityChange(callback: (status: ConnectivityStatus) => void): () => void;

  /**
   * Estimate download time based on current connection
   * @param bytes - Size in bytes to download
   * @returns Estimated time in seconds
   */
  estimateDownloadTime(bytes: number): Promise<number>;

  /**
   * Test connection quality to backend
   * @param apiBaseUrl - Backend API URL
   * @returns Connection quality result
   */
  testConnectionQuality(apiBaseUrl: string): Promise<ConnectionQuality>;
}

/**
 * Sync Rules Configuration (provided by backend)
 */
export interface SyncRules {
  /** Sync only on WiFi? */
  wifiOnly: boolean;

  /** Minimum battery level required (%) */
  minBatteryLevel: number;

  /** Require device to be charging? */
  requireCharging: boolean;

  /** Minimum connection quality */
  minConnectionQuality: ConnectionQuality;

  /** Maximum data usage allowed on cellular (bytes) */
  maxCellularDataUsage: number;

  /** Time window for auto-sync (hours, e.g., "22:00-06:00" for overnight) */
  preferredTimeWindow?: {
    startHour: number; // 0-23
    endHour: number; // 0-23
  };
}

/**
 * Default sync rules (conservative approach for rural areas)
 */
export const DEFAULT_SYNC_RULES: SyncRules = {
  wifiOnly: true,
  minBatteryLevel: 20,
  requireCharging: false,
  minConnectionQuality: "good",
  maxCellularDataUsage: 0, // No cellular sync by default
  // preferredTimeWindow omitted - sync anytime
};

/**
 * Connectivity Event Types
 */
export type ConnectivityEvent =
  | { type: "connected"; connectionType: ConnectionType; quality: ConnectionQuality }
  | { type: "disconnected" }
  | { type: "quality_changed"; oldQuality: ConnectionQuality; newQuality: ConnectionQuality }
  | { type: "sync_eligible"; status: ConnectivityStatus }
  | { type: "sync_ineligible"; reasons: string[] }
  | { type: "battery_low"; batteryLevel: number };

/**
 * Implementation Notes:
 *
 * Frontend Implementation (React Native):
 * 1. Use @react-native-community/netinfo for connectivity detection
 * 2. Use react-native-device-info for battery level
 * 3. Subscribe to connectivity changes and trigger sync when eligible
 * 4. Implement exponential backoff for retry attempts
 * 5. Show user notifications when sync conditions aren't met
 *
 * Backend Support:
 * 1. Provide /api/sync/rules endpoint to fetch current sync rules
 * 2. Allow admin to configure rules per region/user group
 * 3. Track sync eligibility failures for analytics
 * 4. Provide connectivity test endpoint for quality checks
 */
