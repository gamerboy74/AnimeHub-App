/**
 * src/components/ui/RazorpayCheckout.tsx
 *
 * Full-screen, bulletproof WebView-based Razorpay checkout.
 *
 * Senior Engineering Architecture:
 *   1. Intercepts custom URL schemes (upi://, intent://, phonepe://, paytmmp://, tez://, etc.)
 *      so the WebView never crashes with net::ERR_UNKNOWN_URL_SCHEME.
 *   2. Prevents false "Payment Cancelled" callbacks:
 *      - Tracks settlement flag in both WebView JS runtime and React Native ref.
 *      - Razorpay's auto-modal close upon successful payment does NOT trigger modal.ondismiss.
 *      - PAYMENT_FAILED events that occur during app-switching or post-success are ignored.
 *   3. Supports in-checkout "Verify Payment" action for users completing UPI / bank transfers in external apps.
 *   4. Styled to match AnimeHub's sleek cyberpunk dark aesthetic.
 */

import React, { useRef, useState, useCallback } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Text, ActivityIndicator,
  Platform, Linking, Alert, AppState,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';

export interface RazorpayPaymentResult {
  paymentId: string;
  orderId:   string;
  signature: string;
}

interface Props {
  /** Razorpay order ID returned from Edge Function */
  orderId:        string;
  /** Amount in paise (e.g. 9900 for ₹99, 79900 for ₹799) */
  amount:         number;
  /** 'INR' */
  currency:       string;
  /** Razorpay Key ID (rzp_live_xxx or rzp_test_xxx) */
  keyId:          string;
  /** User name and email for checkout prefill */
  userName:       string;
  userEmail:      string;
  /** Plan display label */
  description:    string;
  /** Called when user successfully completes payment */
  onSuccess:      (result: RazorpayPaymentResult) => void;
  /** Called when user deliberately cancels or checkout encounters an unrecoverable error */
  onDismiss:      (reason?: string) => void;
  /** Optional callback to verify external order status if user completed UPI externally */
  onCheckStatus?: () => Promise<boolean>;
}

/**
 * Builds the self-contained HTML page that loads Razorpay Checkout JS.
 * Injected JS coordinates with React Native via window.ReactNativeWebView.postMessage.
 */
function buildCheckoutHtml(props: Props): string {
  const { orderId, amount, currency, keyId, userName, userEmail, description } = props;

  const safe = (s: string) =>
    (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #080810;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #F0EEFF;
      overflow: hidden;
    }
    .container {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 24px; text-align: center;
    }
    .spinner-ring {
      width: 48px; height: 48px; border: 3px solid rgba(255, 43, 60, 0.15);
      border-top-color: #FF2B3C; border-right-color: #FFB800; border-radius: 50%;
      animation: spin 0.9s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite;
      margin-bottom: 20px;
    }
    .brand-title {
      font-size: 16px; font-weight: 800; letter-spacing: 2px; color: #FF2B3C;
      margin-bottom: 6px; text-transform: uppercase;
    }
    .status-text {
      font-size: 13px; color: #8A87A8; letter-spacing: 0.5px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner-ring"></div>
    <div class="brand-title">AnimeHub Secure Pay</div>
    <div class="status-text">Connecting to Razorpay gateway…</div>
  </div>

  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    var paymentSettled = false;

    function postToRN(payload) {
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      } catch (err) {
        console.error("postToRN error:", err);
      }
    }

    window.addEventListener('load', function() {
      var options = {
        key:         "${safe(keyId)}",
        amount:      ${amount},
        currency:    "${safe(currency)}",
        name:        "AnimeHub",
        description: "${safe(description)}",
        order_id:    "${safe(orderId)}",
        prefill: {
          name:  "${safe(userName)}",
          email: "${safe(userEmail)}"
        },
        theme: {
          color: "#FF2B3C",
          backdrop_color: "#08090D"
        },
        modal: {
          backdropclose: false,
          escape: false,
          ondismiss: function() {
            // CRITICAL FIX: If payment has already been captured or handler executed,
            // DO NOT emit DISMISSED. Razorpay closes its modal on success, which would
            // otherwise falsely fire ondismiss and cancel the purchase.
            if (paymentSettled) return;
            postToRN({ type: "DISMISSED" });
          }
        },
        handler: function(response) {
          // Mark settled immediately so any modal close or blur event is suppressed
          paymentSettled = true;
          postToRN({
            type:      "PAYMENT_SUCCESS",
            paymentId: response.razorpay_payment_id,
            orderId:   response.razorpay_order_id,
            signature: response.razorpay_signature
          });
        }
      };

      try {
        var rzp = new Razorpay(options);

        rzp.on('payment.failed', function(response) {
          if (paymentSettled) return;

          var desc = (response && response.error && response.error.description)
            ? response.error.description
            : "Payment failed";

          // If reason is just navigation blur / cancelled by user, send detailed structure
          postToRN({
            type:   "PAYMENT_FAILED",
            reason: desc,
            code:   response && response.error ? response.error.code : null,
            source: response && response.error ? response.error.source : null,
          });
        });

        rzp.open();
      } catch (initErr) {
        if (!paymentSettled) {
          postToRN({ type: "ERROR", message: initErr.message || "Failed to initialize payment gateway" });
        }
      }
    });
  </script>
</body>
</html>`;
}

export default function RazorpayCheckout(props: Props) {
  const { onSuccess, onDismiss, onCheckStatus } = props;
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const isSettledRef = useRef(false);
  const isExternalUpiLaunchedRef = useRef(false);
  const [checkingExternal, setCheckingExternal] = useState(false);
  const [showUpiWaitingBanner, setShowUpiWaitingBanner] = useState(false);

  // Auto-verify when user returns from external UPI app (GPay, PhonePe, Paytm, etc.)
  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (
        nextAppState === 'active' &&
        isExternalUpiLaunchedRef.current &&
        !isSettledRef.current &&
        onCheckStatus
      ) {
        setCheckingExternal(true);
        try {
          const paid = await onCheckStatus();
          if (paid) {
            isSettledRef.current = true;
          }
        } catch {
          // ignore background check error
        } finally {
          setCheckingExternal(false);
        }
      }
    });

    return () => subscription.remove();
  }, [onCheckStatus]);

  // Helper to open deep links (UPI, PhonePe, GPay, Paytm, etc.) safely
  const handleDeepLink = useCallback(async (rawUrl: string) => {
    try {
      let targetUrl = rawUrl;

      // Mark that an external UPI app has been launched
      isExternalUpiLaunchedRef.current = true;
      setShowUpiWaitingBanner(true);

      // Handle Android intent:// links (frequently emitted by Razorpay for UPI)
      // e.g. intent://pay?pa=...#Intent;scheme=upi;package=...;end
      if (rawUrl.startsWith('intent://')) {
        const schemeMatch = rawUrl.match(/scheme=([^;]+)/);
        const scheme = schemeMatch ? schemeMatch[1] : 'upi';
        const pathPart = rawUrl.split('#Intent')[0].replace(/^intent:\/\//, '');
        targetUrl = `${scheme}://${pathPart}`;
      }

      const canOpen = await Linking.canOpenURL(targetUrl);
      if (canOpen) {
        await Linking.openURL(targetUrl);
      } else {
        // Fallback: try rawUrl directly
        const rawCanOpen = await Linking.canOpenURL(rawUrl);
        if (rawCanOpen) {
          await Linking.openURL(rawUrl);
        } else {
          console.warn('[RazorpayCheckout] Could not find app to open URL scheme:', targetUrl);
        }
      }
    } catch (err) {
      console.warn('[RazorpayCheckout] Error handling deep link:', err);
    }
  }, []);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      switch (msg.type) {
        case 'PAYMENT_SUCCESS':
          isSettledRef.current = true;
          setShowUpiWaitingBanner(false);
          onSuccess({
            paymentId: msg.paymentId,
            orderId:   msg.orderId,
            signature: msg.signature,
          });
          break;

        case 'DISMISSED':
          // Suppress dismissal if payment is settled, or if user is currently paying in external UPI app
          if (isSettledRef.current) return;
          if (isExternalUpiLaunchedRef.current) {
            // Keep checkout open so user can verify upon returning from UPI app
            setShowUpiWaitingBanner(true);
            return;
          }
          onDismiss('User cancelled');
          break;

        case 'PAYMENT_FAILED':
          if (isSettledRef.current) return;
          // CRITICAL FIX: If external UPI app was launched, Razorpay's JS SDK may report
          // 'Payment processing cancelled by user' simply because the webview blurred.
          // DO NOT dismiss the screen! Keep waiting for user confirmation or manual verify.
          if (isExternalUpiLaunchedRef.current) {
            setShowUpiWaitingBanner(true);
            return;
          }
          onDismiss(msg.reason ?? 'Payment failed');
          break;

        case 'ERROR':
          if (isSettledRef.current) return;
          if (isExternalUpiLaunchedRef.current) {
            setShowUpiWaitingBanner(true);
            return;
          }
          onDismiss(msg.message ?? 'Checkout error');
          break;
      }
    } catch {
      // Ignore malformed JSON messages
    }
  }, [onSuccess, onDismiss]);

  const handleManualCheck = async () => {
    if (!onCheckStatus) return;
    setCheckingExternal(true);
    try {
      const paid = await onCheckStatus();
      if (!paid) {
        Alert.alert(
          'Payment Status',
          'Payment confirmation not received from bank yet. If you completed payment in Google Pay / PhonePe, please wait 5-10 seconds and tap Verify again.',
          [{ text: 'OK' }],
        );
      }
    } catch {
      Alert.alert('Notice', 'Unable to reach payment verification server. Please try again.');
    } finally {
      setCheckingExternal(false);
    }
  };

  const handleClosePressed = () => {
    if (isSettledRef.current) return;

    // Give user option to verify if they paid in external UPI app
    if (onCheckStatus) {
      Alert.alert(
        'Exit Checkout?',
        'If you completed payment in Google Pay, PhonePe, or your bank app, tap "Check Status" to confirm.',
        [
          { text: 'Check Status', onPress: handleManualCheck },
          {
            text: 'Cancel Payment',
            style: 'destructive',
            onPress: () => {
              if (!isSettledRef.current) {
                onDismiss('User cancelled');
              }
            },
          },
        ],
      );
    } else {
      onDismiss('User cancelled');
    }
  };

  const html = buildCheckoutHtml(props);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Checkout Top Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={handleClosePressed}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={20} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {props.description || 'AnimeHub Premium'}
          </Text>
          <Text style={styles.headerSubtitle}>
            ₹{(props.amount / 100).toFixed(0)} · Razorpay Secure
          </Text>
        </View>

        <View style={styles.headerRight}>
          {onCheckStatus && (
            <TouchableOpacity
              style={styles.verifyBtn}
              onPress={handleManualCheck}
              disabled={checkingExternal}
              activeOpacity={0.7}
            >
              {checkingExternal ? (
                <ActivityIndicator size="small" color={COLORS.neonGold} />
              ) : (
                <>
                  <Ionicons name="refresh" size={12} color={COLORS.neonGold} />
                  <Text style={styles.verifyBtnText}>Verify</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          <View style={styles.secureBadge}>
            <Ionicons name="lock-closed" size={10} color={COLORS.neonCyan} />
            <Text style={styles.secureText}>256-BIT</Text>
          </View>
        </View>
      </View>

      {/* Floating UPI In-Progress Recovery Banner */}
      {showUpiWaitingBanner && (
        <View style={styles.upiWaitingBanner}>
          <View style={styles.upiWaitingLeft}>
            <ActivityIndicator size="small" color={COLORS.neonGold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.upiWaitingTitle}>UPI Payment In Progress</Text>
              <Text style={styles.upiWaitingSub}>
                Complete payment in your UPI app, then tap Verify below.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.upiVerifyBtn}
            onPress={handleManualCheck}
            disabled={checkingExternal}
            activeOpacity={0.8}
          >
            {checkingExternal ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.upiVerifyBtnText}>Verify Now</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Embedded Razorpay WebView */}
      <WebView
        ref={webViewRef}
        source={{ html }}
        onMessage={handleMessage}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color={COLORS.neon} size="large" />
            <Text style={styles.loadingText}>Initializing Payment…</Text>
          </View>
        )}
        onShouldStartLoadWithRequest={(request) => {
          const { url } = request;
          if (!url) return false;

          // Standard web pages (Razorpay checkout, bank gateways, 3DS) stay inside WebView
          if (
            url.startsWith('http://') ||
            url.startsWith('https://') ||
            url.startsWith('about:') ||
            url.startsWith('data:')
          ) {
            return true;
          }

          // Custom schemes (UPI apps, phonepe, paytm, google pay, cred, intent://)
          // MUST be delegated to the OS via Linking, otherwise WebView fails with ERR_UNKNOWN_URL_SCHEME
          handleDeepLink(url);
          return false;
        }}
        style={styles.webview}
        scalesPageToFit={Platform.OS === 'android'}
        allowsInlineMediaPlayback
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080810',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#0E0E1A',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 43, 60, 0.2)',
    gap: SPACING.sm,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: COLORS.textSub,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 214, 0, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 0, 0.3)',
  },
  verifyBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.neonGold,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0, 245, 255, 0.08)',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 255, 0.25)',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  secureText: {
    fontSize: 9,
    color: COLORS.neonCyan,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  webview: {
    flex: 1,
    backgroundColor: '#080810',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#080810',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: 12,
    color: COLORS.textSub,
    letterSpacing: 1,
  },
  upiWaitingBanner: {
    backgroundColor: '#161324',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 214, 0, 0.3)',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  upiWaitingLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  upiWaitingTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.neonGold,
    letterSpacing: 0.3,
  },
  upiWaitingSub: {
    fontSize: 10,
    color: COLORS.textSub,
    lineHeight: 14,
    marginTop: 2,
  },
  upiVerifyBtn: {
    backgroundColor: COLORS.neonGold,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upiVerifyBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.3,
  },
});
