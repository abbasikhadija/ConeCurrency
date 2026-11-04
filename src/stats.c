#include "stats.h"
#include "booking.h"

#include <pthread.h>
#include <stdio.h>

static unsigned counts[4];
static pthread_mutex_t stats_lock = PTHREAD_MUTEX_INITIALIZER;

void stats_inc(enum stats_type type)
{
    if ((int)type >= 0 && type < 4) {
        pthread_mutex_lock(&stats_lock);
        ++counts[type];
        pthread_mutex_unlock(&stats_lock);
    }
}

void stats_print(void)
{
    pthread_mutex_lock(&stats_lock);
    unsigned booked = counts[STAT_BOOKED];
    unsigned sold_out = counts[STAT_SOLD_OUT];
    unsigned busy = counts[STAT_BUSY];
    unsigned bad = counts[STAT_BAD];
    pthread_mutex_unlock(&stats_lock);

    int remaining = booking_remaining();

    printf("ConeCurrency stats: booked=%u sold_out=%u busy=%u bad=%u remaining=%d\n",
           booked, sold_out, busy, bad, remaining);
    fflush(stdout);
}

