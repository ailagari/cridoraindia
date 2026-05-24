import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { JewellerStorefrontDTO } from '@/lib/marketplaceApi'
import { Button, Input, Select } from '@/components/ui'
import {
  filterVerifiedJewellersByQuery,
  jewellerOptionLabel,
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
  const selectedFromKnown = jewellerId !== '' && knownJewellers.some((j) => j.id === jewellerId)
  const [searchMode, setSearchMode] = useState(!isReturning)
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  useEffect(() => {
    if (!isReturning) {
      setSearchMode(true)
    }
  }, [isReturning])

  const suggestions = useMemo(
    () => filterVerifiedJewellersByQuery(allJewellers, searchQuery),
    [allJewellers, searchQuery],
  )

  const selectedJeweller = useMemo(() => {
    if (jewellerId === '') return null
    return (
      allJewellers.find((j) => j.id === jewellerId) ??
      knownJewellers.find((j) => j.id === jewellerId) ??
      null
    )
  }, [allJewellers, jewellerId, knownJewellers])

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
    if (isReturning && !knownJewellers.some((j) => j.id === id)) {
      setSearchMode(true)
    }
  }

  const showSearchField = !isReturning || searchMode || !selectedFromKnown

  return (
    <div ref={rootRef} className="fractional-jeweller-picker">
      {isReturning && !searchMode && selectedFromKnown ? (
        <>
          <Select
            label="Jeweller"
            value={String(jewellerId)}
            disabled={disabled}
            onChange={(e) => {
              const v = e.target.value
              onJewellerChange(v === '' ? '' : Number.parseInt(v, 10))
            }}
          >
            {knownJewellers.map((j) => (
              <option key={j.id} value={j.id}>
                {jewellerOptionLabel(j)}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            style={{ marginTop: 'var(--sp-2)', padding: 0, minHeight: 'auto', fontSize: 'var(--ts-caption)' }}
            onClick={() => {
              setSearchMode(true)
              setSearchQuery('')
              setSuggestOpen(true)
            }}
          >
            Search for a different jeweller
          </Button>
        </>
      ) : null}

      {showSearchField ? (
        <div className="fractional-jeweller-picker__search">
          <Input
            label={isReturning ? 'Search jeweller' : 'Jeweller'}
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
              }
            }}
          />
          {selectedJeweller && searchQuery.trim() === '' ? (
            <p style={{ margin: 'var(--sp-2) 0 0', fontSize: 'var(--ts-caption)', color: 'var(--text-muted)' }}>
              Selected: <strong>{jewellerOptionLabel(selectedJeweller)}</strong>
            </p>
          ) : null}
          {suggestOpen && suggestions.length > 0 ? (
            <ul
              id={listboxId}
              role="listbox"
              className="fractional-jeweller-picker__suggest"
              aria-label="Matching jewellers"
            >
              {suggestions.map((j, idx) => (
                <li key={j.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={activeIndex === idx}
                    className={
                      activeIndex === idx
                        ? 'fractional-jeweller-picker__suggest-item fractional-jeweller-picker__suggest-item--active'
                        : 'fractional-jeweller-picker__suggest-item'
                    }
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => pickJeweller(j.id)}
                  >
                    <span>{j.business_name}</span>
                    <span className="fractional-jeweller-picker__suggest-meta">
                      {[j.city, j.state].filter(Boolean).join(', ') || 'Verified partner'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : suggestOpen && searchQuery.trim() !== '' ? (
            <p className="ds-feedback" style={{ marginTop: 'var(--sp-2)' }}>
              No matching jewellers.
            </p>
          ) : null}
          {isReturning ? (
            <Button
              type="button"
              variant="ghost"
              disabled={disabled}
              style={{ marginTop: 'var(--sp-2)', padding: 0, minHeight: 'auto', fontSize: 'var(--ts-caption)' }}
              onClick={() => {
                setSearchMode(false)
                setSearchQuery('')
                setSuggestOpen(false)
                const restoreId =
                  defaultKnownJewellerId ??
                  (knownJewellers[0] ? knownJewellers[0].id : '')
                onJewellerChange(restoreId === '' ? '' : restoreId)
              }}
            >
              Back to your jewellers
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
