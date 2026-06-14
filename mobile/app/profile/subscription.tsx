import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  ImageBackground,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import {
  createSubscriptionCheckout,
  fetchMySubscription,
  fetchSubscriptionPlans,
  MySubscription,
  parseCheckoutResult,
  SubscriptionConflictError,
  subscriptionCheckoutURLs,
  SubscriptionPlan,
  SubscriptionPlanType,
} from '@/lib/subscriptions';

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function planDisplayName(
  planType: SubscriptionPlanType,
  plans: SubscriptionPlan[]
) {
  return plans.find((plan) => plan.plan_type === planType)?.name ?? planType;
}

export default function SubscriptionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ checkout?: string }>();

  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [current, setCurrent] = useState<MySubscription | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanType | null>(
    null
  );
  const checkoutRefreshPending = useRef(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [plansData, subscription] = await Promise.all([
        fetchSubscriptionPlans(),
        fetchMySubscription(),
      ]);
      setPlans(plansData);
      setCurrent(subscription);
      setSelectedPlan((prev) => prev ?? plansData[0]?.plan_type ?? null);
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Could not load subscriptions.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCheckoutResult = useCallback(
    (checkout?: string | string[]) => {
      checkoutRefreshPending.current = false;
      const value = Array.isArray(checkout) ? checkout[0] : checkout;
      if (value === 'success') {
        Alert.alert('Success', 'Your subscription is being activated.');
        void loadData();
      } else if (value === 'cancel') {
        Alert.alert('Cancelled', 'Checkout was cancelled.');
      }
    },
    [loadData]
  );

  useEffect(() => {
    handleCheckoutResult(params.checkout);
  }, [params.checkout, handleCheckoutResult]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && checkoutRefreshPending.current) {
        checkoutRefreshPending.current = false;
        void loadData();
      }
    });
    return () => sub.remove();
  }, [loadData]);

  const handleBuy = async () => {
    if (!selectedPlan || current) return;

    setBuying(true);
    try {
      const { successUrl, cancelUrl, returnBase } = subscriptionCheckoutURLs();
      const checkoutURL = await createSubscriptionCheckout(
        selectedPlan,
        successUrl,
        cancelUrl
      );

      if (Platform.OS === 'web') {
        window.location.href = checkoutURL;
        return;
      }

      checkoutRefreshPending.current = true;
      await WebBrowser.warmUpAsync();

      const result = await WebBrowser.openAuthSessionAsync(
        checkoutURL,
        returnBase
      );

      WebBrowser.maybeCompleteAuthSession();

      if (result.type === 'success') {
        const checkout = parseCheckoutResult(result.url);
        if (checkout === 'success') {
          handleCheckoutResult('success');
        } else if (checkout === 'cancel') {
          handleCheckoutResult('cancel');
        } else if (checkoutRefreshPending.current) {
          checkoutRefreshPending.current = false;
          void loadData();
        }
      }
    } catch (error) {
      checkoutRefreshPending.current = false;
      if (error instanceof SubscriptionConflictError) {
        Alert.alert('Active subscription', error.message);
        void loadData();
        return;
      }
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Could not start checkout.'
      );
    } finally {
      setBuying(false);
    }
  };

  const hasActiveSubscription = current !== null;
  const hasPlans = plans.length > 0;
  const entrancesTotal = current?.entrances_total ?? null;

  return (
    <ImageBackground
      source={require('@/assets/images/login_signup_background.jpg')}
      style={styles.background}
      imageStyle={{ opacity: 0.4 }}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.glassContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#1E2A5E" />
          </TouchableOpacity>

          <View style={styles.headerIcon}>
            <Feather name="credit-card" size={38} color="#1E2A5E" />
          </View>

          <Text style={styles.title}>Subscription</Text>

          {loading ? (
            <ActivityIndicator color="#1E2A5E" size="large" />
          ) : !hasPlans && !current ? (
            <Text style={styles.infoText}>
              No subscription plans available.
            </Text>
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Current plan</Text>
                {current ? (
                  <>
                    <Text style={styles.planName}>
                      {planDisplayName(current.plan_type, plans)}
                    </Text>
                    <Text style={styles.statusText}>
                      Status: {current.status}
                    </Text>
                    {current.entrances_remaining != null ? (
                      <Text style={styles.perkText}>
                        {current.entrances_remaining}
                        {entrancesTotal != null
                          ? ` of ${entrancesTotal} entrances remaining`
                          : ' entrances remaining'}
                      </Text>
                    ) : (
                      <Text style={styles.perkText}>Unlimited entrances</Text>
                    )}
                    {formatDate(current.expires_at) ? (
                      <Text style={styles.perkText}>
                        Valid until {formatDate(current.expires_at)}
                      </Text>
                    ) : null}
                    {current.perks.map((perk) => (
                      <Text key={perk} style={styles.perkText}>
                        • {perk}
                      </Text>
                    ))}
                  </>
                ) : (
                  <Text style={styles.emptyText}>No active subscription</Text>
                )}
              </View>

              {hasPlans ? (
                <>
                  <Text style={styles.sectionTitle}>Choose a plan</Text>

                  {plans.map((plan) => {
                    const selected = selectedPlan === plan.plan_type;
                    return (
                      <TouchableOpacity
                        key={plan.plan_type}
                        style={[
                          styles.planCard,
                          selected && styles.planCardSelected,
                          hasActiveSubscription && styles.planCardDisabled,
                        ]}
                        onPress={() => setSelectedPlan(plan.plan_type)}
                        disabled={hasActiveSubscription}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.planCardTitle}>{plan.name}</Text>
                        {plan.perks.map((perk) => (
                          <Text key={perk} style={styles.planCardPerk}>
                            • {perk}
                          </Text>
                        ))}
                      </TouchableOpacity>
                    );
                  })}

                  {hasActiveSubscription ? (
                    <Text style={styles.blockedText}>
                      You already have an active subscription. You can buy a new
                      plan after it expires or is cancelled.
                    </Text>
                  ) : null}

                  <TouchableOpacity
                    style={[
                      styles.button,
                      (buying || hasActiveSubscription || !selectedPlan) &&
                        styles.buttonDisabled,
                    ]}
                    onPress={handleBuy}
                    disabled={buying || hasActiveSubscription || !selectedPlan}
                  >
                    {buying ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.buttonText}>BUY SUBSCRIPTION</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  glassContainer: {
    width: '90%',
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 30,
    padding: 28,
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  backButton: {
    alignSelf: 'flex-start',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 18,
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E2A5E',
    marginBottom: 8,
  },
  planName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#222',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 14,
    color: '#444',
    marginBottom: 6,
  },
  perkText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  emptyText: {
    fontSize: 15,
    color: '#444',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  planCard: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  planCardSelected: {
    borderColor: '#1E2A5E',
  },
  planCardDisabled: {
    opacity: 0.6,
  },
  planCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    marginBottom: 4,
  },
  planCardPerk: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  blockedText: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 12,
  },
  infoText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#1E2A5E',
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
