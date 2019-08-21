
import csv
import random
import json

SESSIONS_COUNT = 783
TAHOE_SESSIONS_COUNT = 3

out = []

def add_session(username):
    session_id = 'SD$jsessionId1$SL$jsessionId2$FF$jsessionId3$ADFF$jsessionId4$'
    session_id = reduce(lambda x, y: x.replace(y, str(random.randrange(1000000000, 9999999999))), ['$jsessionId1', '$jsessionId2$', '$jsessionId3$', '$jsessionId4$'], session_id)
    out.append({'session_id': session_id, 'username': username})

if __name__ == '__main__':
    rows = []
    tahoe_rows = []
    with open('../../../../gogen_assets/samples/customer_master_small.csv') as csv_file:
        csv_reader = csv.DictReader(csv_file, delimiter=',')
        for row in csv_reader:
            rows.append(row)

    

    with open('./tahoe_sessions.csv') as csv_file:
        csv_reader = csv.reader(csv_file)
        for row in csv_reader:
            tahoe_rows.append(row)

    for i in xrange(SESSIONS_COUNT):
        add_session(random.choice(rows)['userName'])

    for i in xrange(TAHOE_SESSIONS_COUNT):
        add_session(random.choice(tahoe_rows)[0])

    add_session('mwilde')

    with open('./sessions.json', 'w') as json_file:
        json_file.write(json.dumps(out))

    with open('./session.csv', 'w') as new_csv_file:
        csv_writer = csv.DictWriter(new_csv_file, out[0].keys())
        csv_writer.writerows(out)
    
