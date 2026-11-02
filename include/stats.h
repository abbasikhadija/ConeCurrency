#ifndef CONECURRENCY_STATS_H
#define CONECURRENCY_STATS_H

enum stats_type { STAT_BOOKED, STAT_SOLD_OUT, STAT_BUSY, STAT_BAD };
/* P1 implements thread-safe counters. Called without other locks held. */
void stats_inc(enum stats_type type);
void stats_print(void);

#endif
