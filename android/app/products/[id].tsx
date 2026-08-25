import { useMemo, useState } from 'react'
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import { Alert, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { marketplaceApi } from '../../src/api'
import { resolveMediaUrl } from '../../src/api/client'
import { useCart } from '../../src/store/cart'
import { Button, Card, ErrorState, Loading, SectionTitle } from '../../src/components/ui'
import { colors, radius, spacing } from '../../src/theme'

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{id:string}>(); const { width } = useWindowDimensions()
  const query = useQuery({ queryKey: ['marketplace','product',id], queryFn: () => marketplaceApi.product(id!), enabled: Boolean(id) })
  const add = useCart((state) => state.add); const [variantId,setVariantId] = useState<string>(); const [quantity,setQuantity] = useState(1)
  const product = query.data
  const variants = product?.variants ?? []
  const selected = useMemo(() => variants.find((v) => v.id === variantId) || variants[0], [variants,variantId])
  if (query.isLoading) return <Loading label="Loading product…"/>
  if (!product || query.isError) return <ErrorState message="This product is unavailable." retry={() => query.refetch()}/>
  const firstImage = product.images?.[0]
  const image = resolveMediaUrl(product.primary_image_url || product.image_url || (typeof firstImage === 'string' ? firstImage : firstImage?.url || firstImage?.image_url))
  const stock = selected?.stock_quantity ?? selected?.available_stock ?? selected?.stock_available ?? product.available_stock ?? 0
  const price = selected?.sale_price || selected?.unit_price || selected?.price || product.sale_price || product.price || product.base_price || 0
  const addLine = () => {
    const accepted = add({ productId: product.id, variantId: selected!.id, name: product.name, shopId: product.shop_id || '', shopName: product.shop_name || '', price, quantity, image })
    if (!accepted) Alert.alert('Different Shop', 'Your cart already contains products from another Shop. Complete or clear that cart first.')
    return accepted
  }
  return <View style={styles.screen}><ScrollView contentContainerStyle={styles.page}>{image ? <Image source={image} contentFit="contain" style={[styles.image,{height:Math.min(width,470)}]}/> : <View style={styles.noImage}><Text style={styles.noImageText}>BTMI</Text></View>}<View style={styles.content}><Text style={styles.shop}>{product.shop_name || 'BTMI seller'}</Text><Text style={styles.title}>{product.name}</Text>{product.rating ? <Text style={styles.rating}>{product.rating.toFixed(1)} ★ · {product.review_count || 0} reviews</Text> : null}<Text style={styles.price}>{price.toLocaleString()} {product.currency === 'USD' ? 'USD' : 'FC'}</Text>{variants.length > 0 && <><SectionTitle title="Choose variant"/><View style={styles.variants}>{variants.map((variant) => <Button key={variant.id} variant={(selected?.id === variant.id) ? 'primary' : 'outline'} title={variant.name || Object.values(variant.attributes || {}).join(' / ') || variant.sku || 'Variant'} onPress={() => setVariantId(variant.id)}/>)}</View></>}<Text style={[styles.stock,{color:stock > 0 ? colors.success : colors.danger}]}>{stock > 3 ? `In stock — ${stock} available` : stock > 0 ? `Only ${stock} left` : 'Out of stock'}</Text><Card><SectionTitle title="Quantity"/><View style={styles.qty}><Button variant="outline" title="−" onPress={() => setQuantity(Math.max(1,quantity-1))}/><Text style={styles.qtyValue}>{quantity}</Text><Button variant="outline" title="+" disabled={quantity >= stock} onPress={() => setQuantity(quantity+1)}/></View></Card>{product.description ? <Card><SectionTitle title="Description"/><Text style={styles.description}>{product.description}</Text></Card> : null}</View></ScrollView><View style={styles.actions}><Button variant="outline" title="Add to Cart" disabled={!selected || stock < 1} onPress={addLine}/><Button variant="gold" title="Buy Now" disabled={!selected || stock < 1} onPress={() => { if (addLine()) router.push('/(buyer)/cart') }}/></View></View>
}
const styles = StyleSheet.create({ screen:{flex:1}, page:{paddingBottom:100}, image:{width:'100%',backgroundColor:colors.white},noImage:{height:330,alignItems:'center',justifyContent:'center',backgroundColor:colors.greenSoft},noImageText:{fontSize:34,fontWeight:'900',color:colors.green},content:{padding:spacing.md,gap:spacing.md},shop:{color:colors.green,fontWeight:'800'},title:{fontSize:28,lineHeight:34,fontWeight:'900',color:colors.ink},rating:{color:colors.muted},price:{fontSize:28,fontWeight:'900',color:colors.green},variants:{gap:spacing.sm},stock:{fontSize:16,fontWeight:'900'},qty:{flexDirection:'row',alignItems:'center',gap:spacing.md},qtyValue:{fontWeight:'900',fontSize:20,minWidth:30,textAlign:'center'},description:{color:colors.ink,lineHeight:23},actions:{position:'absolute',bottom:0,left:0,right:0,backgroundColor:colors.white,borderTopWidth:1,borderTopColor:colors.border,padding:spacing.sm,flexDirection:'row',gap:spacing.sm}, })
