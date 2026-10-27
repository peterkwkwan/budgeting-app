import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Stack } from 'expo-router';

import { OfflineBanner } from '@/components/OfflineBanner';
import {
  ScrollEdgeHost,
  useScrollEdges,
} from '@/components/ScrollEdgeShadows';
import { CaptionText, StrongText } from '@/components/StyledText';
import {
  categoriesForType,
  type TransactionType,
} from '@/constants/categories';
import { colors, fonts, radius, space } from '@/constants/theme';
import { useOfflineGates } from '@/hooks/useOfflineGates';
import {
  useArchiveUserCategory,
  useCreateUserCategory,
  useRenameUserCategory,
  useUnarchiveUserCategory,
  useUserCategories,
} from '@/hooks/useUserCategories';

/**
 * Settings → Categories: system list (read-only) + add/rename/archive customs.
 */
export default function CategoriesSettingsScreen() {
  const { edges, scrollProps } = useScrollEdges();
  const customsQuery = useUserCategories();
  const create = useCreateUserCategory();
  const rename = useRenameUserCategory();
  const archive = useArchiveUserCategory();
  const unarchive = useUnarchiveUserCategory();
  const { manageBlocked, manageHint } = useOfflineGates();

  const [tab, setTab] = useState<TransactionType>('expense');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const customs = customsQuery.data ?? [];
  const active = useMemo(
    () => customs.filter((c) => c.type === tab && !c.archived_at),
    [customs, tab]
  );
  const archived = useMemo(
    () => customs.filter((c) => c.type === tab && c.archived_at),
    [customs, tab]
  );
  const system = categoriesForType(tab);

  const busy =
    create.isPending ||
    rename.isPending ||
    archive.isPending ||
    unarchive.isPending;
  const locked = busy || manageBlocked;

  const onAdd = () => {
    if (manageBlocked) return;
    setError(null);
    create.mutate(
      { type: tab, name: newName },
      {
        onSuccess: () => setNewName(''),
        onError: (err) =>
          setError(err instanceof Error ? err.message : 'Could not add.'),
      }
    );
  };

  const startRename = (id: string, current: string) => {
    if (manageBlocked) return;
    setEditingId(id);
    setEditName(current);
    setError(null);
  };

  const saveRename = () => {
    if (!editingId || manageBlocked) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      setError('Enter a category name.');
      return;
    }
    rename.mutate(
      { id: editingId, name: trimmed },
      {
        onSuccess: () => {
          setEditingId(null);
          setEditName('');
        },
        onError: (err) =>
          setError(err instanceof Error ? err.message : 'Could not rename.'),
      }
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Categories' }} />
      <View style={styles.host}>
        <OfflineBanner variant="settings" />
        <ScrollEdgeHost edges={edges} style={styles.scrollHost}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            {...scrollProps}
          >
          <View style={styles.segment}>
            {(['expense', 'income'] as const).map((option) => {
              const selected = tab === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => {
                    setTab(option);
                    setEditingId(null);
                    setError(null);
                  }}
                  style={[styles.segBtn, selected && styles.segBtnSelected]}
                >
                  <StrongText
                    style={[
                      styles.segText,
                      selected && styles.segTextSelected,
                    ]}
                  >
                    {option === 'expense' ? 'Expenses' : 'Income'}
                  </StrongText>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.block}>
            <CaptionText style={styles.label}>Built-in</CaptionText>
            <CaptionText style={styles.hint}>
              These come with Fudget and can’t be removed.
            </CaptionText>
            {system.map((name) => (
              <View key={name} style={styles.row}>
                <StrongText style={styles.rowText}>{name}</StrongText>
              </View>
            ))}
          </View>

          <View style={styles.block}>
            <CaptionText style={styles.label}>Your categories</CaptionText>
            <CaptionText style={styles.hint}>
              Add your own. Archive hides them from pickers; past transactions
              keep the name.
            </CaptionText>
            {manageHint ? (
              <CaptionText style={styles.hint}>{manageHint}</CaptionText>
            ) : null}

            <View style={styles.addRow}>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="New category name"
                placeholderTextColor={colors.inkMuted}
                style={styles.input}
                editable={!locked}
                maxLength={40}
              />
              <Pressable
                style={[styles.addBtn, locked && styles.disabled]}
                disabled={locked || !newName.trim()}
                onPress={onAdd}
              >
                {create.isPending ? (
                  <ActivityIndicator color={colors.inkInverse} />
                ) : (
                  <StrongText style={styles.addBtnText}>Add</StrongText>
                )}
              </Pressable>
            </View>

            {active.length === 0 ? (
              <CaptionText style={styles.empty}>None yet.</CaptionText>
            ) : (
              active.map((c) => (
                <View key={c.id} style={styles.customRow}>
                  {editingId === c.id ? (
                    <View style={styles.editBlock}>
                      <TextInput
                        value={editName}
                        onChangeText={setEditName}
                        style={styles.input}
                        autoFocus
                        maxLength={40}
                      />
                      <View style={styles.editActions}>
                        <Pressable onPress={saveRename} disabled={locked}>
                          <StrongText style={styles.link}>Save</StrongText>
                        </Pressable>
                        <Pressable
                          onPress={() => setEditingId(null)}
                          disabled={locked}
                        >
                          <CaptionText style={styles.muted}>Cancel</CaptionText>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <>
                      <StrongText style={styles.rowText}>{c.name}</StrongText>
                      <View style={styles.actions}>
                        <Pressable
                          onPress={() => startRename(c.id, c.name)}
                          disabled={locked}
                        >
                          <CaptionText style={styles.link}>Rename</CaptionText>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            if (manageBlocked) return;
                            archive.mutate(c.id, {
                              onError: (err) =>
                                setError(
                                  err instanceof Error
                                    ? err.message
                                    : 'Could not archive.'
                                ),
                            });
                          }}
                          disabled={locked}
                        >
                          <CaptionText style={styles.muted}>Archive</CaptionText>
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              ))
            )}
          </View>

          {archived.length > 0 ? (
            <View style={styles.block}>
              <CaptionText style={styles.label}>Archived</CaptionText>
              {archived.map((c) => (
                <View key={c.id} style={styles.customRow}>
                  <StrongText style={[styles.rowText, styles.archived]}>
                    {c.name}
                  </StrongText>
                  <Pressable
                    onPress={() => {
                      if (manageBlocked) return;
                      unarchive.mutate(c.id, {
                        onError: (err) =>
                          setError(
                            err instanceof Error
                              ? err.message
                              : 'Could not restore.'
                          ),
                      });
                    }}
                    disabled={locked}
                  >
                    <CaptionText style={styles.link}>Restore</CaptionText>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          {error ? (
            <CaptionText style={styles.error}>{error}</CaptionText>
          ) : null}
            {customsQuery.isLoading ? (
              <ActivityIndicator color={colors.green[700]} />
            ) : null}
          </ScrollView>
        </ScrollEdgeHost>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1, backgroundColor: colors.canvas },
  scrollHost: { flex: 1 },
  scroll: { flex: 1 },
  container: {
    paddingHorizontal: space.md,
    paddingVertical: space.lg,
    gap: space.md,
    paddingBottom: space.xxl,
  },
  segment: {
    flexDirection: 'row',
    gap: space.sm,
  },
  segBtn: {
    flex: 1,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  segBtnSelected: {
    borderColor: colors.green[700],
    backgroundColor: colors.green[50],
  },
  segText: { color: colors.ink },
  segTextSelected: { color: colors.green[700] },
  block: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: space.md,
    gap: space.sm,
  },
  label: {
    color: colors.inkMuted,
    textTransform: 'uppercase',
  },
  hint: { color: colors.inkMuted },
  row: {
    paddingVertical: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowText: { color: colors.ink },
  archived: { color: colors.inkMuted },
  addRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
  },
  addBtn: {
    backgroundColor: colors.green[700],
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    minWidth: 64,
    alignItems: 'center',
  },
  addBtnText: { color: colors.inkInverse },
  disabled: { opacity: 0.5 },
  empty: { color: colors.inkMuted },
  customRow: {
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: space.xs,
  },
  actions: { flexDirection: 'row', gap: space.md },
  editBlock: { gap: space.sm },
  editActions: { flexDirection: 'row', gap: space.md },
  link: { color: colors.green[700] },
  muted: { color: colors.inkMuted },
  error: { color: colors.danger },
});
