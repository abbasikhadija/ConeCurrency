#ifndef CONECURRENCY_CONCURRENT_H
#define CONECURRENCY_CONCURRENT_H

#include "server.h"
/* P3 supplies implementation. Caller retains ownership of listen_fd.
 * Observe server_stop; join workers before returning, including error paths. */
int concurrent_run(int listen_fd, const struct server_config *config);

#endif
