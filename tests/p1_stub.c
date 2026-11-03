/* TEST SUBSTITUTE ONLY. No synchronization: never use for concurrency tests.
 * This allows P2 networking to be tested before P1 delivers booking/stats. */
#include "booking.h"
#include "stats.h"
#include <stdio.h>

static int remaining;
static unsigned counts[4];
void booking_init(int n) { remaining = n; }
enum booking_result booking_try_reserve(void)
{
    if (!remaining) return BOOK_SOLD_OUT;
    --remaining;
    return BOOK_OK;
}
int booking_remaining(void) { return remaining; }
void stats_inc(enum stats_type type) { ++counts[type]; }
void stats_print(void)
{
    printf("TEST STUB booked=%u sold_out=%u busy=%u bad=%u remaining=%d\n",
           counts[0], counts[1], counts[2], counts[3], remaining);
}
