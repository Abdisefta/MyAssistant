import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { APP_COLORS as COLORS } from '@/constants/app-theme';
import { APP_VERSION } from '@/constants/app-version';

const HIGHLIGHTS = [
  'Professionella mejl med signatur från din profil',
  'Snabbknappar för jobb — t.ex. "Blir sen" och boka möte',
  'Dagsöversikt på Hem: olästa mail och möten idag',
  'Sök i Gmail direkt i Email-fliken',
  'Skickade uppdateras när assistenten mailar åt dig',
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function WhatsNewModal({ visible, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name="sparkles" size={26} color={COLORS.purple} />
            </View>
            <Text style={styles.title}>Nytt i version {APP_VERSION}</Text>
            <Text style={styles.subtitle}>Små förbättringar som gör vardagen enklare.</Text>

            <ScrollView style={styles.listScroll} showsVerticalScrollIndicator={false}>
              {HIGHLIGHTS.map((item) => (
                <View key={item} style={styles.row}>
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.purple} />
                  <Text style={styles.rowText}>{item}</Text>
                </View>
              ))}
            </ScrollView>

            <Pressable style={styles.button} onPress={onClose}>
              <Text style={styles.buttonText}>Fortsätt</Text>
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
    padding: 24,
  },
  safe: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 22,
    gap: 10,
    maxHeight: '85%',
  },
  iconWrap: {
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.purpleMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 4,
  },
  listScroll: {
    maxHeight: 220,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 6,
  },
  rowText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  button: {
    backgroundColor: COLORS.purple,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
});
