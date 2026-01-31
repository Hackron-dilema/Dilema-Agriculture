import { useState } from 'react'

type Address = {
  street: string
  city: string
  state: string
  postalCode: string
  country: string
}

export default function AddressForm() {
  const [address, setAddress] = useState<Address>(() => {
    const saved = localStorage.getItem('profile_address')
    return saved ? JSON.parse(saved) : { street: '', city: '', state: '', postalCode: '', country: '' }
  })
  const [status, setStatus] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function updateField<K extends keyof Address>(k: K, v: string) {
    setAddress(prev => ({ ...prev, [k]: v }))
  }

  async function handleSave() {
    setSaving(true)
    setStatus(null)
    try {
      const base = import.meta.env.VITE_API_URL || ''
      const res = await fetch(`${base}/api/profile/address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(address),
      })
      if (!res.ok) {
        // fallback to localStorage
        localStorage.setItem('profile_address', JSON.stringify(address))
        setStatus('saved-local')
      } else {
        setStatus('saved-server')
      }
    } catch (err) {
      localStorage.setItem('profile_address', JSON.stringify(address))
      setStatus('saved-local')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-8 max-w-3xl mx-auto bg-white p-6 rounded shadow">
      <h2 className="text-xl font-semibold mb-4">చిరునామా</h2>

      <div className="grid grid-cols-1 gap-4">
        <input
          className="border rounded px-3 py-2"
          placeholder="వీధి / రోడ్"
          value={address.street}
          onChange={e => updateField('street', e.target.value)}
        />
        <input
          className="border rounded px-3 py-2"
          placeholder="నగరం"
          value={address.city}
          onChange={e => updateField('city', e.target.value)}
        />
        <input
          className="border rounded px-3 py-2"
          placeholder="ప్రాంతం"
          value={address.state}
          onChange={e => updateField('state', e.target.value)}
        />
        <input
          className="border rounded px-3 py-2"
          placeholder="పిన్ కోడ్"
          value={address.postalCode}
          onChange={e => updateField('postalCode', e.target.value)}
        />
        <input
          className="border rounded px-3 py-2"
          placeholder="దేశం"
          value={address.country}
          onChange={e => updateField('country', e.target.value)}
        />

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-60"
          >
            {saving ? 'సేవ్ చేసేలోపే...' : 'సేవ్ చేయండి'}
          </button>
          {status === 'saved-server' && (
            <span className="text-sm text-green-700">చిరునామా సర్వర్‌కి పంపబడింది</span>
          )}
          {status === 'saved-local' && (
            <span className="text-sm text-yellow-700">చిరునామా స్థానికంగా సేవ్ చేయబడింది</span>
          )}
        </div>
      </div>
    </section>
  )
}
