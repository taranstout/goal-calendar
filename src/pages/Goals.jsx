import { useEffect } from 'react'
import { getCurrentProgress, getPeriodKey } from '../utils/goalPeriods'
import { getGoalIcon } from '../utils/goalIcons'
import PageBanner from '../components/PageBanner'

export default function Goals({ goals, setGoals }) {
  useEffect(() => { window.scrollTo(0, 0) }, [])

  const increment = (id) => {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g
        const key = getPeriodKey(g.frequency || 'weekly')
        const progress = { ...(g.progress || {}) }
        progress[key] = Math.min((progress[key] || 0) + 1, g.target)
        return { ...g, progress }
      })
    )
  }

  const slots = goals.slice(0, 6)
  const row1 = slots[0] || null
  const row2 = [slots[1] || null, slots[2] || null]
  const row3 = [slots[3] || null, slots[4] || null]
  const row4 = slots[5] || null

  const renderFullCard = (goal, showPlus) => {
    if (!goal) return null
    const current = getCurrentProgress(goal)
    const iconDef = getGoalIcon(goal.icon)
    return (
      <div className="gd-card gd-card-full">
        <div className="gd-card-left">
          {iconDef.icon('gd-icon')}
          <div className="gd-text-stack">
            <span className="gd-label">{goal.name}</span>
            <span className="gd-counter">{current}/{goal.target}</span>
          </div>
        </div>
        <div className="gd-sub-box">
          <span className="gd-sub-label">{goal.frequency || 'weekly'}</span>
          <span className="gd-sub-counter">{current}/{goal.target}</span>
          {showPlus && (
            <button className="gd-plus-btn" onClick={() => increment(goal.id)}>+</button>
          )}
        </div>
      </div>
    )
  }

  const renderHalfCard = (goal) => {
    if (!goal) return <div className="gd-card gd-card-half gd-empty" />
    const current = getCurrentProgress(goal)
    const iconDef = getGoalIcon(goal.icon)
    return (
      <div className="gd-card gd-card-half">
        {iconDef.icon('gd-icon')}
        <div className="gd-text-stack">
          <span className="gd-label">{goal.name}</span>
          <span className="gd-counter">{current}/{goal.target}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <PageBanner><h1>Goals</h1></PageBanner>

      {goals.length === 0 ? (
        <div className="card">
          <p className="muted">No goals yet. Add goals from the Home page.</p>
        </div>
      ) : (
        <div className="gd-grid">
          {row1 && renderFullCard(row1, true)}

          {(row2[0] || row2[1]) && (
            <div className="gd-row-2col">
              {renderHalfCard(row2[0])}
              {renderHalfCard(row2[1])}
            </div>
          )}

          {(row3[0] || row3[1]) && (
            <div className="gd-row-2col">
              {renderHalfCard(row3[0])}
              {renderHalfCard(row3[1])}
            </div>
          )}

          {row4 && renderFullCard(row4, false)}
        </div>
      )}
    </div>
  )
}
