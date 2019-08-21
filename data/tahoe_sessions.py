
import csv
import random
import json

if __name__ == '__main__':
    tahoe_sessions = [];
    with open('tahoe_sessions.csv') as csv_file:
        csv_reader = csv.reader(csv_file, delimiter=',')
        for row in csv_reader:
            tahoe_sessions.append(row[0])
    with open('sessions.json') as json_file:
        sessions = json.loads(json_file.read())
        for session in sessions:
            for tahoe_session in tahoe_sessions:
                if tahoe_session == session['username']:
                    print session['session_id']

    
