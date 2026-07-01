import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { APP_COLORS as COLORS } from '@/constants/app-theme';
import { useLocale } from '@/contexts/locale-context';
import {
  isPlayBillingAvailable,
  PRO_PRICE_SEK,
  PRO_SUBSCRIPTION_SKU,
  purchaseProSubscription,
} from '@/services/play-billing';
import type { UsageCheckResult } from '@/services/usage-limits';

type Props = {
  visible: boolean;
  check: UsageCheckResult | null;
  onClose: () => void;
};

export function UpgradeModal({ visible, check, onClose }: Props) {
  const { strings, t } = useLocale();
  const [purchaseBusy, setPurchaseBusy] = useState(false);

  const billingAvailable = isPlayBillingAvailable();
  const isBlocked = check?.period === 'blocked';
  const periodLabel =
    check?.period === 'budget'
      ? strings.upgrade.periodBudget
      : check?.period === 'month'
        ? strings.upgrade.periodMonth
        : check?.period === 'blocked'
          ? 'spärr'
          : strings.upgrade.periodDay;

  const handlePurchasePress = useCallback(async () => {
    if (purchaseBusy) return;
    setPurchaseBusy(true);
    try {
      const result = await purchaseProSubscription();
      Alert.alert(strings.upgrade.comingSoon, result.message);
    } finally {
      setPurchaseBusy(false);
    }
  }, [purchaseBusy, strings.upgrade.comingSoon]);

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons
                name={isBlocked || check?.period === 'budget' ? 'warning-outline' : 'rocket-outline'}
                size={28}
                color={isBlocked || check?.period === 'budget' ? '#F5A623' : COLORS.purple}
              />
            </View>
            <Text style={styles.title}>
              {isBlocked ? strings.upgrade.blockedTitle : strings.upgrade.title}
            </Text>
            <Text style={styles.subtitle}>
              {check?.message ?? strings.upgrade.subtitle}
            </Text>

            {check && !isBlocked ? (
              <View style={styles.limitBox}>
                <Text style={styles.limitText}>
                  {t('upgrade.limitDetail', {
                    used: check.used,
                    limit: check.limit,
                    period: periodLabel,
                  })}
                </Text>
              </View>
            ) : null}

            {!isBlocked ? (
              <View style={styles.priceBox}>
                <Text style={styles.priceLabel}>{strings.upgrade.planLabel}</Text>
                <Text style={styles.price}>{PRO_PRICE_SEK} kr/mån</Text>
                <Text style={styles.priceHint}>{strings.upgrade.planHint}</Text>
                {!billingAvailable ? (
                  <Text style={styles.skuHint}>
                    Produkt-ID (placeholder): {PRO_SUBSCRIPTION_SKU}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {!isBlocked ? (
              <Pressable
                style={[styles.primaryBtn, !billingAvailable && styles.primaryBtnDisabled]}
                onPress={handlePurchasePress}
                disabled={purchaseBusy}
              >
                <Text style={styles.primaryBtnText}>{strings.upgrade.comingSoon}</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.secondaryBtn} onPress={onClose}>
              <Text style={styles.secondaryBtnText}>
                {isBlocked ? strings.upgrade.blockedClose : strings.upgrade.close}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: 20,
  },
  safe: { flex: 1, justifyContent: 'center' },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(139, 124, 247, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  limitBox: {
    backgroundColor: 'rgba(255, 138, 138, 0.1)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 138, 0.25)',
  },
  limitText: {
    color: '#FFB4B4',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  priceBox: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  priceLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginBottom: 4,
  },
  price: {
    color: COLORS.purple,
    fontSize: 28,
    fontWeight: '700',
  },
  priceHint: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  skuHint: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 10,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  primaryBtn: {
    backgroundColor: COLORS.purple,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnDisabled: {
    opacity: 0.85,
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: COLORS.textMuted,
    fontSize: 15,
  },
});
