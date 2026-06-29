/**
 * Form field for adding images. Shows thumbnails of selected/uploaded images
 * with a remove button, plus an "add" tile until `max` is reached. Works for
 * single (max=1) and multi-image fields. Actual upload happens at submit time
 * via `resolvePhotos` — this component only manages the picked list.
 */
import React from "react";
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { TText } from "./TText";
import { colors, radius, spacing } from "../theme";
import { newPhotoKey, pickImages, PhotoItem } from "../uploads";
import { notify } from "../utils/dialog";

interface Props {
  label?: string;
  value: PhotoItem[];
  onChange: (items: PhotoItem[]) => void;
  max?: number;
  required?: boolean;
  hint?: string;
  testID?: string;
}

export function ImagePickerField({
  label,
  value,
  onChange,
  max = 6,
  required,
  hint,
  testID,
}: Props) {
  const [busy, setBusy] = React.useState(false);
  const atMax = value.length >= max;

  const add = async () => {
    if (busy || atMax) return;
    setBusy(true);
    try {
      const remaining = max - value.length;
      const picked = await pickImages(remaining);
      if (picked.length) {
        onChange([
          ...value,
          ...picked.slice(0, remaining).map((local) => ({ key: newPhotoKey(), local })),
        ]);
      }
    } catch (e: any) {
      notify("Couldn't add image", e?.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = (key: string) => onChange(value.filter((i) => i.key !== key));

  return (
    <View style={{ marginBottom: spacing.md }} testID={testID}>
      {label && (
        <TText variant="bodySm" muted style={{ marginBottom: 8 }}>
          {label}
          {required ? " *" : ""}
        </TText>
      )}
      <View style={styles.grid}>
        {value.map((item) => (
          <View key={item.key} style={styles.thumb}>
            <Image
              source={{ uri: item.local?.uri || item.url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => remove(item.key)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              testID={`${testID}-remove`}
            >
              <Feather name="x" size={13} color="#fff" />
            </TouchableOpacity>
            {item.local && (
              <View style={styles.newTag}>
                <TText variant="caption" color="#fff" style={{ fontSize: 9 }}>NEW</TText>
              </View>
            )}
          </View>
        ))}
        {!atMax && (
          <TouchableOpacity style={styles.addTile} onPress={add} disabled={busy} testID={`${testID}-add`}>
            {busy ? (
              <ActivityIndicator color={colors.primaryDark} />
            ) : (
              <>
                <Feather name="plus" size={22} color={colors.primaryDark} />
                <TText variant="caption" color={colors.primaryDark} style={{ marginTop: 2 }}>Add</TText>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
      {hint && (
        <TText variant="caption" muted style={{ marginTop: 6 }}>{hint}</TText>
      )}
    </View>
  );
}

const TILE = 84;
const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  thumb: {
    width: TILE,
    height: TILE,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.bgAlt,
  },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  newTag: {
    position: "absolute",
    left: 4,
    bottom: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  addTile: {
    width: TILE,
    height: TILE,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary + "60",
    borderStyle: "dashed",
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
});
