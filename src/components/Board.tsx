import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import { WeekStrip } from './WeekStrip'
import { SupplyPanel } from './SupplyPanel'
import { PricesPanel } from './PricesPanel'
import { OrdersPanel } from './OrdersPanel'
import { FlowPanel } from './FlowPanel'
import { WeeksChart } from './WeeksChart'
import { ReadOut } from './ReadOut'
import { InfoPanel } from './InfoPanel'

/**
 * The planner board. Lays the panels around the fish, which has zoomed out into the middle cell;
 * the layer itself lets pointer events through so the fish stays clickable.
 */
export function Board() {
  const open = useStore((s) => s.board)
  const resetPlan = useStore((s) => s.resetPlan)
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="board-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.22 } }}>
          <div className="board-top">
            <WeekStrip />
            <button className="btn ghost reset" onClick={resetPlan} title="Back to the seed orders, supply and prices">
              reset plan
            </button>
          </div>
          <div className="board-left">
            <SupplyPanel />
            <PricesPanel />
          </div>
          <div className="board-stage">
            <InfoPanel variant="board" />
          </div>
          <div className="board-right">
            <OrdersPanel />
          </div>
          <div className="board-bottom">
            <FlowPanel />
            <WeeksChart />
            <ReadOut />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
