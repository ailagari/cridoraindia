import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { JewellerStorefrontDTO } from '@/lib/marketplaceApi'
import { Button, Input } from '@/components/ui'
import {
  filterVerifiedJewellersByQuery,
  type FractionalJewellerOption,
} from '@/features/invest/fractionalJewellerSelect'

type Props = {
  allJewellers: JewellerStorefrontDTO[]
  knownJewellers: FractionalJewellerOption[]
  defaultKnownJewellerId: number | null
  jewellerId: number | ''
  onJewellerChange: (id: number | '') => void
  disabled?: boolean
}

function locationLine(j: Pick<FractionalJewellerOption, 'city' | 'state'> & { shop_address?: string }): string {
  const cityState = [j.city.trim(), j.state.trim()].filter(Boolean).join(', ')
  const address = j.shop_address?.trim()
  if (address && cityState) return `${address} · ${cityState}`
  return address || cityState || 'Verified Cridora partner'
}

function SelectedJewellerHero({
  jeweller,
  storefront,
  onChangeClick,
  disabled,
}: {
  jeweller: FractionalJewellerOption
  storefront: JewellerStorefrontDTO | null
  onChangeClick: () => void
  disabled?: boolean
}) {
  const initials = jeweller.business_name.trim().slice(0, 2).toUpperCase() || 'J'
  return (
    <div className="fractional-jeweller-pay-hero" aria-live="polite">
      <div className="fractional-jeweller-pay-hero__glow" aria-hidden="true" />
      <div className="fractional-jeweller-pay-hero__inner">
        <div className="fractional-jeweller-pay-hero__avatar" aria-hidden="true">
          {storefront?.logo_url ? (
            <img src={storefront.logo_url} alt="" className="fractional-jeweller-pay-hero__logo" />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <div className="fractional-jeweller-pay-hero__body">
          <p className="fractional-jeweller-pay-hero__eyebrow">You pay at this jeweller</p>
          <h2 className="fractional-jeweller-pay-hero__name">{jeweller.business_name}</h2>
          <p className="fractional-jeweller-pay-hero__location">{locationLine({ ...jeweller, shop_address: storefront?.shop_address })}</p>
          <div className="fractional-jeweller-pay-hero__badges">
            <span className="fractional-jeweller-pay-hero__badge">Verified partner</span>
            {storefront?.approved_listing_count ? (
              <span className="fractional-jeweller-pay-hero__badge fractional-jeweller-pay-hero__badge--muted">
                {storefront.approved_listing_count} listings
              </span>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="fractional-jeweller-pay-hero__change"
          disabled={disabled}
          onClick={onChangeClick}
        >
          Change
        </Button>
      </div>
    </div>
  )
}

export function FractionalJewellerPicker({
  allJewellers,
  knownJewellers,
  defaultKnownJewellerId,
  jewellerId,
  onJewellerChange,
  disabled,
}: Props) {
  const uid = useId().replace(/:/g, '')
  const listboxId = `fractional-jeweller-suggest-${uid}`
  const rootRef = useRef<HTMLDivElement>(null)

  const isReturning = knownJewellers.length > 0
  const [changeOpen, setChangeOpen] = useState(!isReturning)
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  useEffect(() => {
    if (!isReturning) setChangeOpen(true)
  }, [isReturning])

  const suggestions = useMemo(
    () => filterVerifiedJewellersByQuery(allJewellers, searchQuery),
    [allJewellers, searchQuery],
  )

  const selectedJeweller = useMemo((): FractionalJewellerOption | null => {
    if (jewellerId === '') return null
    const fromAll = allJewellers.find((j) => j.id === jewellerId)
    if (fromAll) {
      return {
        id: fromAll.id,
        business_name: fromAll.business_name,
        city: fromAll.city,
        state: fromAll.state,
      }
    }
    return knownJewellers.find((j) => j.id === jewellerId) ?? null
  }, [allJewellers, jewellerId, knownJewellers])

  const selectedStorefront = useMemo(() => {
    if (jewellerId === '') return null
    return allJewellers.find((j) => j.id === jewellerId) ?? null
  }, [allJewellers, jewellerId])

  useEffect(() => {
    if (!suggestOpen) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setSuggestOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [suggestOpen])

  const pickJeweller = (id: number) => {
    onJewellerChange(id)
    setSearchQuery('')
    setSuggestOpen(false)
    setActiveIndex(-1)
    setChangeOpen(false)
  }

  const closeChangePanel = () => {
    setChangeOpen(false)
    setSearchQuery('')
    setSuggestOpen(false)
    setActiveIndex(-1)
  }

  const showHero = selectedJeweller != null && !changeOpen
  const showChangePanel = changeOpen || selectedJeweller == null

  return (
    <div ref={rootRef} className="fractional-jeweller-picker">
      {showHero && selectedJeweller ? (
        <SelectedJewellerHero
          jeweller={selectedJeweller}
          storefront={selectedStorefront}
          disabled={disabled}
          onChangeClick={() => setChangeOpen(true)}
        />
      ) : null}

      {showChangePanel ? (
        <div className="fractional-jeweller-picker__change-panel">
          {selectedJeweller ? (
            <div className="fractional-jeweller-picker__change-head">
              <p className="fractional-jeweller-picker__change-title">Choose jeweller</p>
              <Button
                type="button"
                variant="ghost"
                className="fractional-jeweller-picker__cancel"
                disabled={disabled}
                onClick={closeChangePanel}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="fractional-jeweller-picker__intro">
              <p className="fractional-jeweller-picker__intro-title">Where will you pay?</p>
              <p className="fractional-jeweller-picker__intro-sub">
                Pick a verified jeweller showroom — your gold is custodied with them after purchase.
              </p>
            </div>
          )}

          {isReturning && knownJewellers.length > 0 ? (
            <div className="fractional-jeweller-known">
              <p className="fractional-jeweller-known__label">Your jewellers</p>
              <div className="fractional-jeweller-known__grid" role="list">
                {knownJewellers.map((j) => {
                  const active = jewellerId === j.id
                  return (
                    <button
                      key={j.id}
                      type="button"
                      role="listitem"
                      disabled={disabled}
                      aria-pressed={active}
                      className={
                        active
                          ? 'fractional-jeweller-known__chip fractional-jeweller-known__chip--active'
                          : 'fractional-jeweller-known__chip'
                      }
                      onClick={() => pickJeweller(j.id)}
                    >
                      <span className="fractional-jeweller-known__chip-name">{j.business_name}</span>
                      <span className="fractional-jeweller-known__chip-meta">{j.city || j.state || 'Verified'}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          <div className="fractional-jeweller-picker__search">
            <Input
              label={isReturning ? 'Search all jewellers' : 'Find jeweller'}
              type="search"
              value={searchQuery}
              disabled={disabled}
              placeholder="Type name, city, or area…"
              autoComplete="off"
              role="combobox"
              aria-expanded={suggestOpen && suggestions.length > 0}
              aria-controls={listboxId}
              aria-autocomplete="list"
              onFocus={() => {
                setSuggestOpen(true)
                if (activeIndex < 0 && suggestions.length > 0) setActiveIndex(0)
              }}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setSuggestOpen(true)
                setActiveIndex(0)
              }}
              onKeyDown={(e) => {
                if (!suggestOpen || suggestions.length === 0) return
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setActiveIndex((i) => (i + 1) % suggestions.length)
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  const pick = suggestions[activeIndex >= 0 ? activeIndex : 0]
                  if (pick) pickJeweller(pick.id)
                } else if (e.key === 'Escape') {
                  setSuggestOpen(false)
                  setActiveIndex(-1)
                  if (selectedJeweller) closeChangePanel()
                }
              }}
            />

            {suggestOpen && suggestions.length > 0 ? (
              <ul
                id={listboxId}
                role="listbox"
                className="fractional-jeweller-picker__suggest"
                aria-label="Matching jewellers"
              >
                {suggestions.map((j, idx) => {
                  const selected = jewellerId === j.id
                  return (
                    <li key={j.id} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={activeIndex === idx || selected}
                        className={
                          activeIndex === idx
                            ? 'fractional-jeweller-picker__suggest-item fractional-jeweller-picker__suggest-item--active'
                            : 'fractional-jeweller-picker__suggest-item'
                        }
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => pickJeweller(j.id)}
                      >
                        <span className="fractional-jeweller-picker__suggest-name">{j.business_name}</span>
                        <span className="fractional-jeweller-picker__suggest-meta">
                          {[j.city, j.state].filter(Boolean).join(', ') || 'Verified partner'}
                          {selected ? ' · selected' : ''}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : suggestOpen && searchQuery.trim() !== '' ? (
              <p className="ds-feedback fractional-jeweller-picker__empty">No matching jewellers.</p>
            ) : null}
          </div>

          {isReturning && defaultKnownJewellerId != null ? (
            <Button
              type="button"
              variant="ghost"
              className="fractional-jeweller-picker__restore"
              disabled={disabled}
              onClick={() => {
                pickJeweller(defaultKnownJewellerId)
              }}
            >
              Use last paid jeweller
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
