import { motion } from 'framer-motion'
import { useT } from '../i18n'

const rise = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.2, 0.8, 0.2, 1] as const } },
}

export function Header() {
  const t = useT()
  return (
    <motion.header
      className="header"
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, y: -24, scale: 0.96, transition: { duration: 0.28 } }}
      variants={{ show: { transition: { staggerChildren: 0.14 } } }}
    >
      <motion.p className="overline" variants={rise}>
        {t('header.overline')}
      </motion.p>
      <motion.h1 variants={rise}>{t('header.title')}</motion.h1>
      <motion.div className="rule" variants={rise}>
        <span />
        <p>{t('header.rule')}</p>
        <span />
      </motion.div>
    </motion.header>
  )
}
