#!/bin/bash
cd /home/user/New_Gungun/outlook_agent
while true; do
    python webhook_receiver.py --port 8765
    echo "Server died, restarting in 3s..."
    sleep 3
done
