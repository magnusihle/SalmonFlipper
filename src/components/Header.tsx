import { motion } from 'framer-motion'

const rise = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.2, 0.8, 0.2, 1] as const } },
}

export function Header() {
  return (
    <motion.header
      className="header"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.14 } } }}
    >
      <motion.p className="overline" variants={rise}>
        The Ultimate
      </motion.p>
      <motion.h1 variants={rise}>Salmon Cuts</motion.h1>
      <motion.div className="rule" variants={rise}>
        <span />
        <p>and culinary guide</p>
        <span />
      </motion.div>
    </motion.header>
  )
}
