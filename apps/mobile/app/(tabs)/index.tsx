import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useAuth } from '@/lib/auth';

export default function HomeScreen() {
  const { user, profile, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>You are signed in</Text>
      <View style={styles.card} lightColor="#f3f6f4" darkColor="#1a2420">
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email ?? '—'}</Text>

        <Text style={styles.label}>Display name</Text>
        <Text style={styles.value}>{profile?.display_name ?? '—'}</Text>

        <Text style={styles.label}>Timezone</Text>
        <Text style={styles.value}>{profile?.timezone ?? '—'}</Text>
      </View>

      <Text style={styles.note}>
        M0 scaffold: auth + profile only. Ledger, stats, recurring, and partner
        land in later milestones.
      </Text>

      <Pressable style={styles.button} onPress={() => void signOut()}>
        <Text style={styles.buttonText} lightColor="#fff" darkColor="#fff">
          Sign out
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  card: {
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  label: {
    marginTop: 8,
    fontSize: 12,
    opacity: 0.6,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 16,
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.7,
  },
  button: {
    marginTop: 'auto',
    backgroundColor: '#2e7d4f',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
