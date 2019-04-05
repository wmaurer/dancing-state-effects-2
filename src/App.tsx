import React, { useCallback } from 'react';
import { unionize, ofType, UnionOf } from 'unionize';
import { Option, some, none } from 'fp-ts/lib/Option';
import { findFirst } from 'fp-ts/lib/Array';
import { useEventCallback } from 'rxjs-hooks';
import { withLatestFrom, map, tap, concatMap } from 'rxjs/operators';

type ItemData = { id: number; name: string; modifiedAt: Date };
type PartialItemData = { id: number } & Partial<ItemData>;
type ServerSavedItemData = { id: number; modifiedAt: Date };

type VoidableCallback<EventValue> = (val: EventValue) => void;

const modifiedAt = new Date('2018-12-31T23:59:59.999Z');
const itemData: ItemData[] = [
    { id: 1, name: 'Milk Chocolate', modifiedAt },
    { id: 2, name: 'Dark Chocolate', modifiedAt },
    { id: 3, name: 'White Chocolate', modifiedAt },
    { id: 4, name: 'Raw Chocolate', modifiedAt },
    { id: 5, name: 'Chocolate Milk', modifiedAt },
];

let lastColor: string;

const generateNewColor = () =>
    (lastColor = 'rgba(' + Math.random() * 255 + ',' + Math.random() * 255 + ',' + Math.random() * 255 + ',1)');

const ChangedIndicator = () => <div style={{ backgroundColor: lastColor, width: 25, height: 25 }} />;

const Row = React.memo<{
    item: ItemData;
    editing: boolean;
    onEdit: (id: number) => void;
    onSave: (item: ItemData) => void;
}>(({ item, editing, onEdit, onSave }) => {
    return (
        <div
            style={{
                borderBottom: '1px solid #f0f0f0',
                padding: 10,
                display: 'flex',
            }}
            onClick={() => onEdit(item.id)}
        >
            <div style={{ flex: 1 }}>
                {editing ? (
                    <input
                        defaultValue={item.name}
                        style={editing ? undefined : { width: 0, opacity: 0 }}
                        onBlur={e => onSave({ ...item, name: e.target.value })}
                    />
                ) : (
                    <>
                        <span>{item.name}</span>&nbsp;&nbsp;
                        <span style={{ fontSize: '0.67em' }}>{item.modifiedAt.toLocaleString()}</span>
                    </>
                )}
            </div>
            <ChangedIndicator />
        </div>
    );
});

type State = {
    items: ItemData[];
    editingId: Option<number>;
};

const Action = unionize(
    { saveItem: ofType<ItemData>(), applyChanges: ofType<ServerSavedItemData>(), editItem: ofType<number>() },
    { value: 'payload' },
);
type Action = UnionOf<typeof Action>;

const reducer = (state: State, action: Action): State =>
    Action.match({
        saveItem: item => ({ ...state, items: state.items.map(it => (it.id === item.id ? item : it)) }),
        applyChanges: item => ({
            ...state,
            items: state.items.map(it => (it.id === item.id ? applyChanges(it, item) : it)),
        }),
        editItem: id => ({ ...state, editingId: some(id) }),
    })(action);

const initialStateValue: State = {
    items: itemData,
    editingId: none,
};

const getDiff = (_ia: ItemData, ib: ItemData): PartialItemData => ib;
const applyChanges = (ia: ItemData, ib: ServerSavedItemData): ItemData => ({ ...ia, modifiedAt: ib.modifiedAt });

const App = () => {
    const [dispatch, state] = useEventCallback<Action, State>(
        (event$, state$) =>
            event$.pipe(
                withLatestFrom(state$),
                map(([action, state]) => reducer(state, action)),
            ),
        initialStateValue,
    );

    const [saveItem] = useEventCallback<ItemData, unknown, [State, VoidableCallback<Action>]>(
        (item$, input$) =>
            item$.pipe(
                withLatestFrom(input$),
                tap(([item, [, _dispatch]]) => _dispatch(Action.saveItem(item))),
                map(([item, [state]]) =>
                    findFirst(state.items, a => a.id === item.id)
                        .map(a => getDiff(a, item))
                        .getOrElse(item),
                ),
                concatMap(saveItemData),
                withLatestFrom(input$),
                tap(([item, [, _dispatch]]) => _dispatch(Action.applyChanges(item))),
            ),
        null,
        [state, dispatch],
    );

    generateNewColor();

    const onEdit = useCallback((id: number) => dispatch(Action.editItem(id)), [dispatch]);

    return (
        <>
            {state.items.map(item => (
                <Row
                    key={item.id}
                    item={item}
                    editing={state.editingId.fold(false, id => id === item.id)}
                    onEdit={onEdit}
                    onSave={saveItem}
                />
            ))}
        </>
    );
};

const saveItemData = (item: PartialItemData): Promise<ServerSavedItemData> =>
    new Promise(resolve => setTimeout(() => resolve({ ...item, modifiedAt: new Date() }), 3000));

export default App;
