#include "booking.h"

#include <pthread.h>
#include <time.h>

static int remaining;
static pthread_mutex_t inventory_lock = PTHREAD_MUTEX_INITIALIZER;

void booking_init(int n)
{
#ifndef UNSAFE_MODE
    pthread_mutex_lock(&inventory_lock);
#endif
    remaining = n;
#ifndef UNSAFE_MODE
    pthread_mutex_unlock(&inventory_lock);
#endif
}

enum booking_result booking_try_reserve(void)
{
#ifndef UNSAFE_MODE
    pthread_mutex_lock(&inventory_lock);
#endif

    enum booking_result result;
    if (remaining > 0) {
#ifdef UNSAFE_MODE
        /* Intentionally widen the race-condition window for demonstration */
        int temp = remaining;
        struct timespec delay = {0, 50000L}; /* 50 microseconds */
        nanosleep(&delay, NULL);
        remaining = temp - 1;
#else
        --remaining;
#endif
        result = BOOK_OK;
    } else {
        result = BOOK_SOLD_OUT;
    }

#ifndef UNSAFE_MODE
    pthread_mutex_unlock(&inventory_lock);
#endif

    return result;
}

int booking_remaining(void)
{
#ifndef UNSAFE_MODE
    pthread_mutex_lock(&inventory_lock);
#endif
    int count = remaining;
#ifndef UNSAFE_MODE
    pthread_mutex_unlock(&inventory_lock);
#endif
    return count;
}

