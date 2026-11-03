#ifndef CONECURRENCY_BOOKING_H
#define CONECURRENCY_BOOKING_H

enum booking_result { BOOK_OK, BOOK_SOLD_OUT };
/* P1 implements these. Initialize once, before starting workers.
 * Reserve and remaining must synchronize all access to shared inventory. */
void booking_init(int n);
enum booking_result booking_try_reserve(void);
int booking_remaining(void);

#endif
