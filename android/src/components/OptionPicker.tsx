import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useColors } from '../store/theme'
import { colorSwatch } from '../lib/colorSwatch'
import { toggleValue } from '../lib/attributeOptions'
import type { Colors } from '../theme'

/**
 * Chip picker replacing free typing for attribute values, mirroring
 * web-app/src/components/seller/OptionPicker.tsx. Single mode emits one
 * string; multiple mode emits the list.
 */
export function OptionPicker({
  label,
  options,
  swatch = false,
  value,
  multiple = false,
  required = false,
  onChange,
}: {
  label: string
  options: string[]
  swatch?: boolean
  value: string | string[]
  multiple?: boolean
  required?: boolean
  onChange: (next: string | string[]) => void
}) {
  const c = useColors()
  const s = useMemo(() => makeStyles(c), [c])
  const selected = Array.isArray(value) ? value : value ? [value] : []
  const isOn = (v: string) => selected.some((x) => x.toLowerCase() === v.toLowerCase())

  return (
    <View style={s.wrap}>
      <Text style={s.label}>
        {label}{required ? ' *' : ''}
        {selected.length > 0 ? <Text style={s.value}>  {selected.join(', ')}</Text> : null}
      </Text>
      <View style={s.chips}>
        {options.map((option) => {
          const on = isOn(option)
          const dot = swatch ? colorSwatch(option) : null
          return (
            <Pressable
              key={option}
              accessibilityRole={multiple ? 'checkbox' : 'radio'}
              accessibilityState={{ checked: on }}
              accessibilityLabel={option}
              onPress={() => (multiple ? onChange(toggleValue(selected, option)) : onChange(on ? '' : option))}
              style={[s.chip, on && s.chipOn]}
            >
              {swatch ? (
                <View style={[s.dot, dot ? { backgroundColor: dot } : s.dotMulti, on && s.dotOn]} />
              ) : null}
              <Text style={[s.chipText, on && s.chipTextOn]}>{option}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    wrap: { gap: 8 },
    label: { color: c.ink, fontWeight: '500', fontSize: 14 },
    value: { color: c.muted, fontWeight: '400' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: c.border, backgroundColor: c.white, flexDirection: 'row', alignItems: 'center', gap: 7 },
    chipOn: { backgroundColor: c.ink, borderColor: c.ink },
    chipText: { color: c.ink, fontSize: 14, fontWeight: '500' },
    chipTextOn: { color: c.onGreen },
    dot: { width: 16, height: 16, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.25)' },
    dotMulti: { backgroundColor: '#8d8d8a' },
    dotOn: { borderColor: '#FFFFFF', borderWidth: 1.5 },
  })
