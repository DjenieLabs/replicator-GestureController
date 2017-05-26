#! /bin/sh
#
# make your block for local testing
# by Djenie 2016

echo "\033[32m\n\n    __   \n   / /\  \n  / / .\     Replicator\n /_/    \ \n \ \.   /  Community Block\n  \ \  / \n   \_\/  \n\n\n Access your replicator IDE and test your new community block\n\n"
http-server -p 3080 --cors -c-1

if [ $? -eq 0 ]; then
    exit $?
else
    echo "\033[31m\n Error\n\n Please try this before:\n npm install http-server -g"
    exit $?
fi
