import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { Session, loadSessions, deleteSession } from '../storage/sessions';

interface Props {
  visible: boolean;
  onClose: () => void;
  devFont: string | undefined;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function HistoryScreen({ visible, onClose, devFont }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<Session | null>(null);

  useEffect(() => {
    if (visible) {
      loadSessions().then(setSessions);
    } else {
      setSelected(null);
    }
  }, [visible]);

  const handleDelete = useCallback((id: string) => {
    Alert.alert('सत्र हटवा', 'हे सत्र कायमचे हटवायचे आहे का?', [
      { text: 'रद्द करा', style: 'cancel' },
      {
        text: 'हटवा',
        style: 'destructive',
        onPress: async () => {
          await deleteSession(id);
          setSessions(prev => prev.filter(s => s.id !== id));
          setSelected(null);
        },
      },
    ]);
  }, []);

  const handleShare = useCallback(async (session: Session) => {
    await Share.share({ message: session.text, title: session.title });
  }, []);

  const renderCard = ({ item }: { item: Session }) => (
    <TouchableOpacity style={styles.card} onPress={() => setSelected(item)} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <Text style={[styles.cardTitle, { fontFamily: item.language === 'mr-IN' ? devFont : undefined }]} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={[styles.langBadge, item.language === 'en-IN' && styles.langBadgeEn]}>
          <Text style={styles.langBadgeText}>{item.language === 'mr-IN' ? 'मराठी' : 'EN'}</Text>
        </View>
      </View>
      <Text style={styles.cardMeta}>
        {formatDate(item.createdAt)} · {item.wordCount} शब्द
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { fontFamily: devFont }]}>
            {selected ? selected.title : 'इतिहास'}
          </Text>
          <TouchableOpacity onPress={selected ? () => setSelected(null) : onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>{selected ? '← मागे' : '✕'}</Text>
          </TouchableOpacity>
        </View>

        {selected ? (
          /* Detail view */
          <View style={styles.flex1}>
            <ScrollView contentContainerStyle={styles.detailContent}>
              <Text style={[styles.detailText, { fontFamily: selected.language === 'mr-IN' ? devFont : undefined }]}>
                {selected.text}
              </Text>
            </ScrollView>
            <View style={styles.detailActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleShare(selected)} activeOpacity={0.8}>
                <Text style={[styles.actionBtnText, { fontFamily: devFont }]}>📤 शेअर करा</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={() => handleDelete(selected.id)} activeOpacity={0.8}>
                <Text style={[styles.actionBtnText, styles.actionBtnDangerText, { fontFamily: devFont }]}>🗑 हटवा</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* List view */
          sessions.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { fontFamily: devFont }]}>अजून कोणतेही सत्र जतन केले नाही.</Text>
            </View>
          ) : (
            <FlatList
              data={sessions}
              keyExtractor={item => item.id}
              renderItem={renderCard}
              contentContainerStyle={styles.list}
            />
          )
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex1: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.accentDeep,
    flex: 1,
  },
  closeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  closeBtnText: {
    fontSize: 15,
    color: colors.accentDeep,
    fontWeight: '600',
  },
  list: {
    padding: 12,
    gap: 10,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 14,
    gap: 4,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  langBadge: {
    backgroundColor: colors.accentLight,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  langBadgeEn: {
    backgroundColor: '#e8f0fe',
    borderColor: '#b3c8f5',
  },
  langBadgeText: {
    fontSize: 10,
    color: colors.accentDeep,
    fontWeight: '600',
  },
  cardMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
  },
  detailContent: {
    padding: 16,
    flexGrow: 1,
  },
  detailText: {
    fontSize: 16,
    color: colors.textPrimary,
    lineHeight: 28,
  },
  detailActions: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    backgroundColor: colors.surface,
    borderTopWidth: 1.5,
    borderTopColor: colors.border,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accentDeep,
  },
  actionBtnDanger: {
    backgroundColor: colors.redBg,
    borderColor: '#f0a9a4',
  },
  actionBtnDangerText: {
    color: colors.red,
  },
});
